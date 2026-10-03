INSERT INTO organizations (id, name)
VALUES
  (10, 'Organization 10'),
  (20, 'Organization 20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash)
VALUES (
  1,
  'mock-user@example.com',
  '$argon2id$v=19$m=19456,p=1,t=2$6jzS+iA8hGK9GBKfrMYq3w$jJzUU2OLHcEhFtvBvnQn4oWwGXp4izoUd+c2K3xsyPs'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_memberships (organization_id, user_id, role)
VALUES (10, 1, 'MEMBER')
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO projects (id, organization_id, name)
VALUES
  (100, 10, 'Organization 10 project'),
  (999, 20, 'Organization 20 project')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('organizations', 'id'),
  (SELECT MAX(id) FROM organizations),
  true
);

SELECT setval(
  pg_get_serial_sequence('users', 'id'),
  (SELECT MAX(id) FROM users),
  true
);

SELECT setval(
  pg_get_serial_sequence('projects', 'id'),
  (SELECT MAX(id) FROM projects),
  true
);
