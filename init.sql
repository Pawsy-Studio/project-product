CREATE USER freedraw_user WITH PASSWORD 'changeme123';
CREATE DATABASE freedraw_db OWNER freedraw_user;
GRANT ALL PRIVILEGES ON DATABASE freedraw_db TO freedraw_user;

\c freedraw_db;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
