# NOT VALIDATED: terraform was not available where this was written, so run
# `terraform fmt -check && terraform validate` before the first apply.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "name" {
  type    = string
  default = "nimbus-items"
}

provider "aws" {
  region = var.region
}

resource "aws_dynamodb_table" "items" {
  name         = var.name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "table" {
  statement {
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Scan"]
    resources = [aws_dynamodb_table.items.arn]
  }
}

resource "aws_iam_role_policy" "table" {
  name   = "table-access"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.table.json
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.name}-api"
  role             = aws_iam_role.lambda.arn
  filename         = "${path.module}/../dist/bundle.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist/bundle.zip")
  handler          = "lambda.lambdaHandler"
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  memory_size      = 256
  timeout          = 10

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.items.name
    }
  }
}

resource "aws_apigatewayv2_api" "http" {
  name          = var.name
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each  = toset(["GET /health", "GET /items", "POST /items", "GET /items/{id}", "DELETE /items/{id}"])
  api_id    = aws_apigatewayv2_api.http.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 200
    throttling_rate_limit  = 100
  }
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

output "api_url" {
  value = aws_apigatewayv2_api.http.api_endpoint
}
