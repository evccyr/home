watch:
	watchexec -r just run

line:
	@echo -e "--------------------------------------\n"

run: line
	cargo run

ui: line
	npm run dev

test:
	watchexec -r cargo test
