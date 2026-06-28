.PHONY: run test lint format typecheck check clean frontend-install frontend-build

run:
	uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

frontend-install:
	cd frontend && npm install

frontend-build:
	cd frontend && npm run build

test:
	pytest tests/ -v

lint:
	ruff check src/ tests/

format:
	ruff format src/ tests/

typecheck:
	mypy src/

check: lint format test

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
