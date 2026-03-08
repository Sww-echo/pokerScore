BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE auth_type_enum AS ENUM ('guest', 'wechat');
CREATE TYPE user_status_enum AS ENUM ('active', 'disabled');
CREATE TYPE room_status_enum AS ENUM ('active', 'settled', 'closed');
CREATE TYPE round_status_enum AS ENUM ('active', 'settled');

CREATE TABLE app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_type auth_type_enum NOT NULL,
  nickname VARCHAR(32) NOT NULL,
  accent VARCHAR(32) NOT NULL DEFAULT 'sunset',
  avatar_url VARCHAR(255),
  wechat_openid VARCHAR(64),
  device_id VARCHAR(64),
  status user_status_enum NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_app_user_wechat_openid UNIQUE (wechat_openid)
);

CREATE TABLE room (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) NOT NULL,
  name VARCHAR(64) NOT NULL,
  owner_user_id UUID NOT NULL,
  status room_status_enum NOT NULL DEFAULT 'active',
  current_round_no INT NOT NULL DEFAULT 1,
  version BIGINT NOT NULL DEFAULT 1,
  last_settled_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_room_code UNIQUE (code),
  CONSTRAINT fk_room_owner_user
    FOREIGN KEY (owner_user_id) REFERENCES app_user(id),
  CONSTRAINT chk_room_code_format
    CHECK (code ~ '^[A-Z0-9]{4,8}$'),
  CONSTRAINT chk_room_current_round_no
    CHECK (current_round_no >= 1),
  CONSTRAINT chk_room_version
    CHECK (version >= 1)
);

CREATE TABLE room_member (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  user_id UUID NOT NULL,
  nickname VARCHAR(32) NOT NULL,
  accent VARCHAR(32) NOT NULL DEFAULT 'sunset',
  avatar_url VARCHAR(255),
  seat_label VARCHAR(16),
  score INT NOT NULL DEFAULT 0,
  is_online BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ(3),
  CONSTRAINT uidx_room_member_room_user UNIQUE (room_id, user_id),
  CONSTRAINT fk_room_member_room
    FOREIGN KEY (room_id) REFERENCES room(id),
  CONSTRAINT fk_room_member_user
    FOREIGN KEY (user_id) REFERENCES app_user(id)
);

CREATE TABLE room_round (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  round_no INT NOT NULL,
  status round_status_enum NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ(3),
  settled_by_member_id UUID,
  open_request_id VARCHAR(64),
  version BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT uidx_room_round_room_round_no UNIQUE (room_id, round_no),
  CONSTRAINT uidx_room_round_open_request_id UNIQUE (open_request_id),
  CONSTRAINT fk_room_round_room
    FOREIGN KEY (room_id) REFERENCES room(id),
  CONSTRAINT fk_room_round_settled_by_member
    FOREIGN KEY (settled_by_member_id) REFERENCES room_member(id),
  CONSTRAINT chk_room_round_round_no
    CHECK (round_no >= 1),
  CONSTRAINT chk_room_round_version
    CHECK (version >= 1),
  CONSTRAINT chk_room_round_settled_state
    CHECK (
      (status = 'active' AND settled_at IS NULL)
      OR (status = 'settled' AND settled_at IS NOT NULL)
    )
);

CREATE TABLE transfer_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  round_id UUID NOT NULL,
  request_id VARCHAR(64) NOT NULL,
  operator_member_id UUID NOT NULL,
  item_count INT NOT NULL DEFAULT 1,
  total_score INT NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_transfer_batch_request_id UNIQUE (request_id),
  CONSTRAINT fk_transfer_batch_room
    FOREIGN KEY (room_id) REFERENCES room(id),
  CONSTRAINT fk_transfer_batch_round
    FOREIGN KEY (round_id) REFERENCES room_round(id),
  CONSTRAINT fk_transfer_batch_operator_member
    FOREIGN KEY (operator_member_id) REFERENCES room_member(id),
  CONSTRAINT chk_transfer_batch_item_count
    CHECK (item_count >= 1),
  CONSTRAINT chk_transfer_batch_total_score
    CHECK (total_score > 0)
);

CREATE TABLE transfer_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_batch_id UUID NOT NULL,
  room_id UUID NOT NULL,
  round_id UUID NOT NULL,
  from_member_id UUID NOT NULL,
  to_member_id UUID NOT NULL,
  score INT NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_transfer_record_batch
    FOREIGN KEY (transfer_batch_id) REFERENCES transfer_batch(id),
  CONSTRAINT fk_transfer_record_room
    FOREIGN KEY (room_id) REFERENCES room(id),
  CONSTRAINT fk_transfer_record_round
    FOREIGN KEY (round_id) REFERENCES room_round(id),
  CONSTRAINT fk_transfer_record_from_member
    FOREIGN KEY (from_member_id) REFERENCES room_member(id),
  CONSTRAINT fk_transfer_record_to_member
    FOREIGN KEY (to_member_id) REFERENCES room_member(id),
  CONSTRAINT chk_transfer_record_score
    CHECK (score > 0),
  CONSTRAINT chk_transfer_record_member_direction
    CHECK (from_member_id <> to_member_id)
);

CREATE TABLE settlement_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  round_id UUID NOT NULL,
  request_id VARCHAR(64),
  settled_by_member_id UUID NOT NULL,
  settled_at TIMESTAMPTZ(3) NOT NULL,
  ranking_json JSONB NOT NULL,
  suggestions_json JSONB NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_settlement_snapshot_round_id UNIQUE (round_id),
  CONSTRAINT uidx_settlement_snapshot_request_id UNIQUE (request_id),
  CONSTRAINT fk_settlement_snapshot_room
    FOREIGN KEY (room_id) REFERENCES room(id),
  CONSTRAINT fk_settlement_snapshot_round
    FOREIGN KEY (round_id) REFERENCES room_round(id),
  CONSTRAINT fk_settlement_snapshot_settled_by_member
    FOREIGN KEY (settled_by_member_id) REFERENCES room_member(id)
);

CREATE TABLE room_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  round_id UUID,
  operator_member_id UUID,
  event_type VARCHAR(32) NOT NULL,
  request_id VARCHAR(64),
  payload_json JSONB,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_room_event_room
    FOREIGN KEY (room_id) REFERENCES room(id),
  CONSTRAINT fk_room_event_round
    FOREIGN KEY (round_id) REFERENCES room_round(id),
  CONSTRAINT fk_room_event_operator_member
    FOREIGN KEY (operator_member_id) REFERENCES room_member(id)
);

CREATE INDEX idx_app_user_auth_type ON app_user(auth_type);
CREATE INDEX idx_app_user_device_id ON app_user(device_id);

CREATE INDEX idx_room_owner_user_id ON room(owner_user_id);
CREATE INDEX idx_room_status ON room(status);

CREATE INDEX idx_room_member_room_online ON room_member(room_id, is_online);
CREATE INDEX idx_room_member_room_joined_at ON room_member(room_id, joined_at);

CREATE INDEX idx_room_round_room_status ON room_round(room_id, status);
CREATE UNIQUE INDEX uidx_room_round_one_active
  ON room_round(room_id)
  WHERE status = 'active';

CREATE INDEX idx_transfer_batch_room_created_at ON transfer_batch(room_id, created_at DESC);
CREATE INDEX idx_transfer_batch_round_created_at ON transfer_batch(round_id, created_at DESC);

CREATE INDEX idx_transfer_record_round_created_at ON transfer_record(round_id, created_at DESC);
CREATE INDEX idx_transfer_record_from_member_created_at ON transfer_record(from_member_id, created_at DESC);
CREATE INDEX idx_transfer_record_to_member_created_at ON transfer_record(to_member_id, created_at DESC);

CREATE INDEX idx_settlement_snapshot_room_settled_at
  ON settlement_snapshot(room_id, settled_at DESC);

CREATE INDEX idx_room_event_room_created_at ON room_event(room_id, created_at DESC);
CREATE INDEX idx_room_event_round_created_at ON room_event(round_id, created_at DESC);
CREATE INDEX idx_room_event_type_created_at ON room_event(event_type, created_at DESC);
CREATE INDEX idx_room_event_request_id ON room_event(request_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_app_user_set_updated_at
BEFORE UPDATE ON app_user
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_room_set_updated_at
BEFORE UPDATE ON room
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE transfer_batch IS '一笔转分请求批次。用于承接前端 requestId 幂等，以及多人转分拆多条流水的场景。';
COMMENT ON TABLE transfer_record IS '实际记分流水。一条 from_member -> to_member 的正整数转分记录。';
COMMENT ON TABLE room_round IS '房间局信息。结算后重开局会新增新的一行。';

COMMIT;
