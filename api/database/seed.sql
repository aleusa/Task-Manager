INSERT INTO organizations (id, name)
VALUES
  (10, 'Organization 10'),
  (20, 'Organization 20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email)
VALUES (1, 'mock-user@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_memberships (organization_id, user_id, role)
VALUES (10, 1, 'member')
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
