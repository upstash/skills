# Upstash CLI Reference Data

## Redis regions

**AWS:** `us-east-1`, `us-east-2`, `us-west-1`, `us-west-2`, `ca-central-1`, `eu-central-1`, `eu-west-1`, `eu-west-2`, `sa-east-1`, `ap-south-1`, `ap-northeast-1`, `ap-southeast-1`, `ap-southeast-2`, `af-south-1`

**GCP:** `us-central1`, `us-east4`, `europe-west1`, `asia-northeast1`

## Vector options

**Regions:** `eu-west-1`, `us-east-1`, `us-central1`

**Similarity functions:** `COSINE`, `EUCLIDEAN`, `DOT_PRODUCT`

**Index types:** `DENSE`, `SPARSE`, `HYBRID`

**Dense embedding models:** `BGE_SMALL_EN_V1_5`, `BGE_BASE_EN_V1_5`, `BGE_LARGE_EN_V1_5`, `BGE_M3`

**Sparse embedding models:** `BM25`, `BGE_M3`

For `HYBRID` indexes with managed embeddings, set `--dimension-count 0`.
