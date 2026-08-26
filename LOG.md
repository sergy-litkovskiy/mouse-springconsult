You are a senior full-stack developer (Node.js + Angular).
Before starting work on a feature, you need to set up the environment using Docker Compose (it must work the same way on both Ubuntu and macOS).
Architecture: a modular monolith across multiple containers.
Verification: Add the recommended lint and Prettier settings for the project.
--------------------------------------------------------------------------------------
### F1 - We’re creating the first feature, “Auth,” for the mouse-springconsult project. As part of this feature, we’ll be building:
## Backend (Node.js 26+, Caddy, REST, JWT, Postgres, TypeORM, TypeScript 6+):
# scope:
    - routes and endpoints for authorization;
    - the Users entity;
	  - SQL migration to create the database (mouse_trading) and the users table in the database;
    - SQL migration to create the first user (up, down);
    - unit tests;
# functionality:
    - user authorization in the system (login);
    - logout;

## Frontend (Angular 22+, TypeScript 6+, Material Angular 22+):
# scope:
    - Components, services, types, HTML, and CSS for authentication;
    - tests;
# functionality:
    - Ability to navigate to the authentication form page (login (email), password);
	  - the ability for the user to stay logged in (checkbox);
    - UI in Ukrainian without translations;
    - invalid login highlights form fields in red and displays an error message;
    - successful validation leads to a temporary welcome page;

It took about 1 hour to complete the feature.

--------------------------------------------------------------------------------

### F2 - We’re creating the second “Products” feature for the mouse-springconsult project. As part of this feature, we’ll be developing:
## Backend (Node.js 26+, Caddy, REST, JWT, Postgres, TypeORM, TypeScript 6+):
# scope:
    - routes and endpoints;
	- unit tests for services, if needed;
    - PostgreSQL migrations to create the database (mouse_trading) and the tables required for the “Products” feature;
	- Basic fields for database tables containing product descriptions: id, title for Prom, description for Prom, title for OLX, description for OLX, price, SEO keywords, category, published, account for Prom, account for OLX, product state (used or new);
    - Product images will be physically stored on Cloudflare R2 (to be implemented later). Image links and IDs are stored in the database. There can be up to 10 images per product, with one marked as the main image;
# functionality:
    - Retrieve a list of products with pagination, filters (title, description, price, category, published, account for Prom, account for OLX), and sorting (title for Prom, title for OLX, price). All fields must be retrieved, including the list of images.

## Frontend (Angular 22+, TypeScript 6+, Material Angular 22+):
# scope:
    - Components, services, types, HTML, and CSS for products;
    - Tests, if needed;
# functionality:
    - Display a list of products with pagination, filters (title, description, price, category, published, account for prom, account for olx), and sorting (title for prom, title for olx, price). In the table, display a thumbnail of the main image and, next to it, the total number of images (clicking on the number opens a modal window showing all the images for that product).
