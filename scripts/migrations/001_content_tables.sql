CREATE TABLE app.series_entries (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  era text NOT NULL,
  title text NOT NULL,
  subtitle text,
  summary text,
  image text,
  page_path text,
  sort_order integer,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE app.product_entries (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  series text,
  grade text,
  scale text,
  price_text text,
  price_value integer,
  release_date text,
  image text,
  gallery jsonb,
  features jsonb,
  detail text,
  page_path text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE TABLE app.content_submissions (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  action text NOT NULL,
  target_id uuid,
  payload jsonb NOT NULL,
  author_user_id text NOT NULL,
  author_name text,
  status text NOT NULL,
  ai_opinion text,
  ai_suggestion text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL
);
CREATE INDEX content_submissions_status_idx ON app.content_submissions (status);
CREATE INDEX product_entries_grade_idx ON app.product_entries (grade);
