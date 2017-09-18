
-- tables
BEGIN;



-- Table: updates
DROP TABLE IF EXISTS updates;

CREATE TABLE updates
(
  ts timestamp with time zone DEFAULT current_timestamp,
  object_id uuid NOT NULL,
  table_name TEXT NOT NULL
);

-- Table: entities

DROP TABLE IF EXISTS entities;

CREATE TABLE entities
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  last_modified timestamp with time zone DEFAULT current_timestamp ,
  layer_id uuid NOT NULL,
  user_id uuid NOT NULL,
  properties json NOT NULL,
  geom geometry(Point, 4326) NOT NULL
);

-- Table: paths

DROP TABLE IF EXISTS paths;

CREATE TABLE paths
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  last_modified timestamp with time zone DEFAULT current_timestamp ,
  layer_id uuid NOT NULL,
  user_id uuid NOT NULL,
  properties json NOT NULL,
  geom geometry(LineString, 4326) NOT NULL
);
-- Table: spreads

DROP TABLE IF EXISTS spreads;

CREATE TABLE spreads
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  last_modified timestamp with time zone DEFAULT current_timestamp ,
  layer_id uuid NOT NULL,
  user_id uuid NOT NULL,
  properties json NOT NULL,
  geom geometry(Polygon, 4326) NOT NULL
);


-- Table: layers

DROP TABLE IF EXISTS layers;

CREATE TABLE layers
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  last_modified timestamp with time zone DEFAULT current_timestamp ,
  user_id uuid NOT NULL,
  properties json NOT NULL
);



-- Table: users

DROP TABLE IF EXISTS users;

CREATE TABLE users
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  last_modified timestamp with time zone DEFAULT current_timestamp ,
  auth_id uuid NOT NULL,
  properties json NOT NULL
);



-- Table: compositions

DROP TABLE IF EXISTS compositions;

CREATE TABLE compositions
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  layer_id uuid NOT NULL,
  group_id uuid NOT NULL
);


-- Table: groups
-- status_flag 0 => public; 1 => private; 2 => user

DROP TABLE IF EXISTS groups;

CREATE TABLE groups
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  last_modified timestamp with time zone DEFAULT current_timestamp ,
  user_id uuid NOT NULL,
  status_flag integer NOT NULL,
  properties json NOT NULL
);



-- Table: auth

DROP TABLE IF EXISTS auth;

CREATE TABLE auth
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  email char(256) NOT NULL UNIQUE,
  password char(60) NOT NULL
);


-- Table: tags

DROP TABLE IF EXISTS tags;

CREATE TABLE tags
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  user_id uuid NOT NULL,
  name char(256) NOT NULL
);


-- Table: medias

DROP TABLE IF EXISTS medias;

CREATE TABLE medias
(
  id uuid NOT NULL PRIMARY KEY,
  creation_date timestamp with time zone DEFAULT current_timestamp,
  last_modified timestamp with time zone DEFAULT current_timestamp ,
  user_id uuid NOT NULL,
  properties json NOT NULL
);


COMMIT;

BEGIN;
-- views
DROP VIEW IF EXISTS features;
CREATE VIEW features 
AS 
(
    SELECT 
        p.id, 
        ST_Envelope(p.geom) AS bbox, 
        'paths' AS table_name, 
        c.group_id 
    FROM paths AS p 
        LEFT JOIN compositions AS c  
        ON p.layer_id = c.layer_id
    ) 
UNION
(
    SELECT 
        p.id, 
        ST_Envelope(p.geom) AS bbox, 
        'spreads' AS table_name, 
        c.group_id 
    FROM spreads AS p 
        LEFT JOIN compositions AS c  
        ON p.layer_id = c.layer_id
    );
COMMIT;


BEGIN;
-- functions

CREATE OR REPLACE FUNCTION log_update()
RETURNS TRIGGER AS $$
DECLARE
  table_name TEXT := TG_ARGV[0];
BEGIN
  EXECUTE 'INSERT INTO "updates" (object_id, table_name) VALUES ($1, $2);' USING NEW.id, table_name;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_update_entities 
BEFORE UPDATE ON entities 
FOR EACH ROW EXECUTE PROCEDURE  log_update('entities');

CREATE TRIGGER log_update_paths
BEFORE UPDATE ON paths
FOR EACH ROW EXECUTE PROCEDURE  log_update('paths');

CREATE TRIGGER log_update_spreads 
BEFORE UPDATE ON spreads 
FOR EACH ROW EXECUTE PROCEDURE  log_update('spreads');

CREATE TRIGGER log_update_layers 
BEFORE UPDATE ON layers 
FOR EACH ROW EXECUTE PROCEDURE  log_update('layers');

CREATE TRIGGER log_update_users 
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE  log_update('users');

CREATE TRIGGER log_update_groups 
BEFORE UPDATE ON groups 
FOR EACH ROW EXECUTE PROCEDURE  log_update('groups');

CREATE TRIGGER log_update_medias 
BEFORE UPDATE ON medias 
FOR EACH ROW EXECUTE PROCEDURE  log_update('medias');


COMMIT;