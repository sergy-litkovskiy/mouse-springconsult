#!/bin/bash
# --no-deps: Postgres уже піднятий стеком, а без прапорця compose run запустив би migrate
# і накотив би нову міграцію на dev-базу.
docker compose run --rm -T --no-deps api npm run test >/dev/null 2>&1 &&
  docker compose run --rm -T --no-deps web npm run test >/dev/null 2>&1 && exit 0
echo "Тести червоні. Задача не закривається, поки не позеленіють обидва прогони:
docker compose run --rm --no-deps api npm run test
docker compose run --rm --no-deps web npm run test" >&2
exit 2
