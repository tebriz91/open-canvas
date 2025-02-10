# Create Dockerfile
dockerfile:
	@echo "Creating Dockerfile..."
	@npx @langchain/langgraph-cli dockerfile -c langgraph.json Dockerfile

# Build docker image
build:
	@echo "Building docker image..."
	@docker build -t lg .

# Docker compose up
up:
	@echo "Starting docker compose..."
	@docker compose up

# Docker compose down
down:
	@echo "Stopping docker compose..."
	@docker compose down
