CREATE TABLE app_user (
 id bigserial PRIMARY KEY, email varchar(254) NOT NULL UNIQUE, display_name varchar(80) NOT NULL,
 password_hash varchar(100) NOT NULL, role varchar(16) NOT NULL CHECK(role IN ('READER','ADMIN')),
 enabled boolean NOT NULL DEFAULT true, email_verified boolean NOT NULL DEFAULT false,
 session_version bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE book (
 id bigserial PRIMARY KEY, title varchar(200) NOT NULL, author varchar(150) NOT NULL,
 isbn varchar(32) UNIQUE, description varchar(6000) NOT NULL DEFAULT '', category varchar(80) NOT NULL,
 cover_url varchar(300), status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','UNPUBLISHED','ARCHIVED')),
 published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE loan (
 id bigserial PRIMARY KEY, book_id bigint NOT NULL REFERENCES book, reader_id bigint NOT NULL REFERENCES app_user,
 borrowed_at timestamptz NOT NULL, due_at timestamptz NOT NULL, returned_at timestamptz,
 renewal_count integer NOT NULL DEFAULT 0 CHECK(renewal_count>=0),
 fine_rate_minor bigint NOT NULL CHECK(fine_rate_minor>=0), fine_cap_minor bigint NOT NULL CHECK(fine_cap_minor>=0),
 CHECK(due_at>borrowed_at), CHECK(returned_at IS NULL OR returned_at>=borrowed_at)
);
CREATE UNIQUE INDEX uq_loan_active_book ON loan(book_id) WHERE returned_at IS NULL;
CREATE INDEX ix_loan_reader ON loan(reader_id,borrowed_at DESC);
CREATE TABLE reservation (
 id bigserial PRIMARY KEY, book_id bigint NOT NULL REFERENCES book, reader_id bigint NOT NULL REFERENCES app_user,
 status varchar(16) NOT NULL CHECK(status IN ('WAITING','READY','CLAIMED','CANCELLED','EXPIRED')),
 created_at timestamptz NOT NULL, ready_at timestamptz, expires_at timestamptz
);
CREATE UNIQUE INDEX uq_reservation_active ON reservation(book_id,reader_id) WHERE status IN ('WAITING','READY');
CREATE UNIQUE INDEX uq_reservation_ready_book ON reservation(book_id) WHERE status='READY';
CREATE INDEX ix_reservation_queue ON reservation(book_id,created_at,id) WHERE status IN ('WAITING','READY');
CREATE TABLE notification (
 id bigserial PRIMARY KEY, reader_id bigint NOT NULL REFERENCES app_user, event_key varchar(180) NOT NULL UNIQUE,
 title varchar(200) NOT NULL, body text NOT NULL, type varchar(40) NOT NULL,
 is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL
);
CREATE TABLE email_delivery (
 id bigserial PRIMARY KEY, recipient varchar(254) NOT NULL, subject varchar(200) NOT NULL, body text NOT NULL,
 event_key varchar(180) NOT NULL UNIQUE, status varchar(16) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','FAILED')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL, sent_at timestamptz, created_at timestamptz NOT NULL
);
CREATE TABLE account_token (
 id bigserial PRIMARY KEY, user_id bigint NOT NULL REFERENCES app_user, token_hash varchar(64) NOT NULL UNIQUE,
 purpose varchar(20) NOT NULL CHECK(purpose IN ('VERIFY','RESET')), expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE TABLE fine (
 id bigserial PRIMARY KEY, loan_id bigint NOT NULL UNIQUE REFERENCES loan,
 amount_minor bigint NOT NULL CHECK(amount_minor>=0), waived_minor bigint NOT NULL DEFAULT 0 CHECK(waived_minor>=0),
 status varchar(16) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','SETTLED','WAIVED')), created_at timestamptz NOT NULL,
 CHECK(waived_minor<=amount_minor)
);
CREATE TABLE fine_adjustment (
 id bigserial PRIMARY KEY, fine_id bigint NOT NULL REFERENCES fine, actor_id bigint NOT NULL REFERENCES app_user,
 amount_minor bigint NOT NULL, reason varchar(500) NOT NULL, created_at timestamptz NOT NULL
);
CREATE TABLE audit_log (
 id bigserial PRIMARY KEY, actor_id bigint REFERENCES app_user, action varchar(80) NOT NULL,
 target varchar(120) NOT NULL, detail varchar(1000) NOT NULL, created_at timestamptz NOT NULL
);
