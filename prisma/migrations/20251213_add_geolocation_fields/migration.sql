-- Add geolocation fields to nodes table
ALTER TABLE "nodes" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "nodes" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "nodes" ADD COLUMN "country" TEXT;
ALTER TABLE "nodes" ADD COLUMN "city" TEXT;

-- Create index for geographic queries
CREATE INDEX "nodes_latitude_longitude_idx" ON "nodes" ("latitude", "longitude") WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
CREATE INDEX "nodes_country_idx" ON "nodes" ("country") WHERE "country" IS NOT NULL;
