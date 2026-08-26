You are a senior full-stack developer (Node.js + Angular).
Before starting work on a feature, you need to set up the environment using Docker Compose (it must work the same way on both Ubuntu and macOS).
Architecture: a modular monolith across multiple containers.
Verification: Add the recommended lint and Prettier settings fot the project.

### F1 - We’re creating the first feature, “Auth,” for the mouse-springconsult project. As part of this feature, we’ll be building:
## Backend (Node.js 26+, Caddy, REST, JWT, Postgres, TypeORM, TypeScript 6+):
# components:
    - routes and endpoints for authorization;
    - the Users entity;
	- SQL migration to create the database (mouse_trading) and the users table in the database;
    - SQL migration to create the first user (up, down);
    - unit tests;
# functionality:
    - user authorization in the system (login);
    - logout;

## Frontend (Angular 22+, TypeScript 6+, Material Angular 22+):
# components:
    - Components, services, types, HTML, and CSS for authentication;
    - tests;
# functionality:
    - Ability to navigate to the authentication form page (login (email), password);
	- the ability for the user to stay logged in (checkbox);
    - UI in Ukrainian without translations;
    - invalid login highlights form fields in red and displays an error message;
    - successful validation leads to a temporary welcome page;

It took about 1 hour to complete the feature.
