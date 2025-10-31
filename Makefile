all: build start

build:
	@docker compose -f ./compose.yaml build

start:
	@docker compose -f ./compose.yaml up -d

dev: build
	@docker compose -f ./compose.yaml watch

stop:
	@docker compose -f ./compose.yaml stop

down:
	@docker compose -f ./compose.yaml down

logs:
	@docker compose -f ./compose.yaml logs -f

clean:
	@docker stop $$(docker ps -qa) 2>/dev/null; \
	docker rm $$(docker ps -qa) 2>/dev/null; \
	docker rmi -f $$(docker images -qa) 2>/dev/null; \
	docker volume rm $$(docker volume ls -q) 2>/dev/null; \
	docker network rm $$(docker network ls -q) 2>/dev/null

prune:
	@docker system prune -af --volumes

re: clean all

.PHONY: all build start stop restart logs clean prune re