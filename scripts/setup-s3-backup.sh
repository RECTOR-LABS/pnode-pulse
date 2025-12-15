#!/bin/bash
# ==================================================================
# S3 Backup Setup Script for pNode Pulse
# ==================================================================
# This script helps configure off-site backups to S3 or compatible
# storage providers (Backblaze B2, Wasabi, MinIO).
#
# Usage: ./scripts/setup-s3-backup.sh
# ==================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       pNode Pulse - S3 Backup Configuration              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo -e "${YELLOW}AWS CLI is not installed.${NC}"
  echo ""
  echo "Install options:"
  echo "  1. pip3 install awscli"
  echo "  2. apt install awscli  (Debian/Ubuntu)"
  echo "  3. brew install awscli (macOS)"
  echo ""
  read -p "Would you like to install via pip3? (y/n): " INSTALL_AWS
  if [[ "$INSTALL_AWS" =~ ^[Yy]$ ]]; then
    pip3 install awscli --user
    echo -e "${GREEN}✓ AWS CLI installed${NC}"
  else
    echo -e "${RED}Please install AWS CLI manually and re-run this script.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}✓ AWS CLI is installed${NC}"
echo ""

# Choose provider
echo "Select your storage provider:"
echo "  1. AWS S3 (Amazon Web Services)"
echo "  2. Backblaze B2"
echo "  3. Wasabi"
echo "  4. MinIO (self-hosted)"
echo "  5. Other S3-compatible"
echo ""
read -p "Enter choice (1-5): " PROVIDER_CHOICE

case $PROVIDER_CHOICE in
  1)
    PROVIDER="AWS S3"
    ENDPOINT_URL=""
    ;;
  2)
    PROVIDER="Backblaze B2"
    echo ""
    read -p "Enter your B2 region (e.g., us-west-002): " B2_REGION
    ENDPOINT_URL="https://s3.${B2_REGION}.backblazeb2.com"
    ;;
  3)
    PROVIDER="Wasabi"
    echo ""
    echo "Wasabi regions: us-east-1, us-east-2, us-central-1, us-west-1, eu-central-1, eu-central-2, eu-west-1, eu-west-2, ap-northeast-1, ap-northeast-2, ap-southeast-1, ap-southeast-2"
    read -p "Enter your Wasabi region (e.g., us-east-1): " WASABI_REGION
    ENDPOINT_URL="https://s3.${WASABI_REGION}.wasabisys.com"
    ;;
  4)
    PROVIDER="MinIO"
    read -p "Enter your MinIO endpoint URL (e.g., http://minio.example.com:9000): " ENDPOINT_URL
    ;;
  5)
    PROVIDER="Custom S3-compatible"
    read -p "Enter your S3-compatible endpoint URL: " ENDPOINT_URL
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}Selected: ${PROVIDER}${NC}"
echo ""

# Get credentials
echo "Enter your S3 credentials:"
read -p "Access Key ID: " AWS_ACCESS_KEY_ID
read -sp "Secret Access Key: " AWS_SECRET_ACCESS_KEY
echo ""
read -p "Bucket name: " AWS_S3_BUCKET
read -p "Region (e.g., us-east-1): " AWS_REGION

echo ""
echo "Testing connection..."

# Test connection
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="${AWS_REGION}"

TEST_CMD="aws s3 ls s3://${AWS_S3_BUCKET}/ --max-items 1"
if [ -n "$ENDPOINT_URL" ]; then
  TEST_CMD="$TEST_CMD --endpoint-url $ENDPOINT_URL"
fi

if eval "$TEST_CMD" &>/dev/null; then
  echo -e "${GREEN}✓ Connection successful!${NC}"
else
  echo -e "${YELLOW}⚠ Bucket may not exist or credentials may be incorrect.${NC}"
  echo "Attempting to create bucket..."

  CREATE_CMD="aws s3 mb s3://${AWS_S3_BUCKET} --region ${AWS_REGION}"
  if [ -n "$ENDPOINT_URL" ]; then
    CREATE_CMD="$CREATE_CMD --endpoint-url $ENDPOINT_URL"
  fi

  if eval "$CREATE_CMD" &>/dev/null; then
    echo -e "${GREEN}✓ Bucket created successfully!${NC}"
  else
    echo -e "${RED}✗ Could not connect or create bucket. Please check credentials.${NC}"
    exit 1
  fi
fi

# Save configuration
echo ""
echo "Saving configuration..."

ENV_FILE="${HOME}/.pnode-pulse-backup.env"
cat > "$ENV_FILE" << EOF
# pNode Pulse S3 Backup Configuration
# Generated: $(date)
# Provider: ${PROVIDER}

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="${AWS_REGION}"
export AWS_S3_BUCKET="${AWS_S3_BUCKET}"
EOF

if [ -n "$ENDPOINT_URL" ]; then
  echo "export AWS_ENDPOINT_URL=\"${ENDPOINT_URL}\"" >> "$ENV_FILE"
fi

cat >> "$ENV_FILE" << EOF

# Optional: Storage class (STANDARD, STANDARD_IA, GLACIER)
export AWS_S3_STORAGE_CLASS="STANDARD_IA"

# Optional: S3 retention days (default: 90)
export S3_RETENTION_DAYS="90"
EOF

chmod 600 "$ENV_FILE"
echo -e "${GREEN}✓ Configuration saved to: ${ENV_FILE}${NC}"

# Update crontab suggestion
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo ""
echo "To enable S3 backups, update your crontab:"
echo ""
echo -e "${YELLOW}crontab -e${NC}"
echo ""
echo "Add this line:"
echo ""
echo -e "${GREEN}0 2 * * * source ${ENV_FILE} && POSTGRES_PASSWORD=\$POSTGRES_PASSWORD /path/to/pnode-pulse/scripts/backup-db.sh >> /var/log/pnode-pulse-backup.log 2>&1${NC}"
echo ""
echo "Or test manually:"
echo ""
echo -e "${YELLOW}source ${ENV_FILE}${NC}"
echo -e "${YELLOW}export POSTGRES_PASSWORD=your_password${NC}"
echo -e "${YELLOW}./scripts/backup-db.sh${NC}"
echo ""
echo "Configuration file location: ${ENV_FILE}"
echo ""

# Test upload
read -p "Would you like to test the backup now? (y/n): " TEST_BACKUP
if [[ "$TEST_BACKUP" =~ ^[Yy]$ ]]; then
  echo ""
  echo "Creating test file and uploading..."
  TEST_FILE="/tmp/pnode-pulse-test-$(date +%s).txt"
  echo "pNode Pulse S3 backup test - $(date)" > "$TEST_FILE"

  UPLOAD_CMD="aws s3 cp $TEST_FILE s3://${AWS_S3_BUCKET}/backups/test.txt"
  if [ -n "$ENDPOINT_URL" ]; then
    UPLOAD_CMD="$UPLOAD_CMD --endpoint-url $ENDPOINT_URL"
  fi

  if eval "$UPLOAD_CMD"; then
    echo -e "${GREEN}✓ Test upload successful!${NC}"

    # Clean up test file
    DELETE_CMD="aws s3 rm s3://${AWS_S3_BUCKET}/backups/test.txt"
    if [ -n "$ENDPOINT_URL" ]; then
      DELETE_CMD="$DELETE_CMD --endpoint-url $ENDPOINT_URL"
    fi
    eval "$DELETE_CMD" &>/dev/null || true
    rm -f "$TEST_FILE"

    echo -e "${GREEN}✓ S3 backup is ready to use!${NC}"
  else
    echo -e "${RED}✗ Test upload failed. Please check configuration.${NC}"
    rm -f "$TEST_FILE"
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}Done! Your backups will now be stored in S3.${NC}"
