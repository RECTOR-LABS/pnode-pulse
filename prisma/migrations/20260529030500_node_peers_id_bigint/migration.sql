-- Widen NodePeer.id (and its backing sequence) from int4 to bigint.
--
-- The autoincrement sequence `node_peers_id_seq` reached the int4 maximum
-- (2147483647), so `prisma.nodePeer.upsert()` started failing with
-- PostgresError 2200H ("nextval: reached maximum value of sequence"),
-- aborting the collector's peer-update cycles. The sequence burns a value on
-- every ON CONFLICT upsert (not just inserts), which exhausted int4 over time.
--
-- bigint removes the ceiling. NodePeer.id is a pure surrogate key (nothing
-- foreign-keys to it), so widening it is safe. Note: this ALTER COLUMN rewrites
-- the table under an ACCESS EXCLUSIVE lock — brief, but it does lock node_peers.

ALTER TABLE "node_peers" ALTER COLUMN "id" SET DATA TYPE BIGINT;

ALTER SEQUENCE "node_peers_id_seq" AS bigint MAXVALUE 9223372036854775807;
