# Contract: S3 Snapshot File Schema

**Feature**: `003-s3-daily-snapshot`
**Type**: Output contract — structure of files written to S3

---

## Storage Location

| Property | Value |
|----------|-------|
| S3 key pattern | `runs/YYYY-MM-DD.json` |
| Content-Type | `application/json` |
| Encoding | UTF-8 |
| Consistency | Atomic replacement (PutObject guarantees no partial reads during overwrite) |

---

## Top-Level Object

```json
{
  "runId":        "<uuid-v4>",
  "date":         "YYYY-MM-DD",
  "startTime":    "YYYY-MM-DDTHH:mm:ss.sssZ",
  "productCount": <integer ≥ 0>,
  "pagesExpected": <integer ≥ 1>,
  "pagesFetched":  <integer ≥ 0>,
  "products": [ <ProductRecord>, ... ]
}
```

### Constraints

- `runId`: UUID v4 format, unique per execution.
- `date`: Calendar date in the timezone configured by `TIMEZONE` env var (default UTC).
- `startTime`: ISO 8601 with milliseconds, always UTC (`Z` suffix).
- `productCount`: MUST equal `products.length`.
- `pagesExpected`: Value of `totalPages` from Dutchie API `queryInfo`.
- `pagesFetched`: Count of distinct page indices from which ≥1 product was retrieved. A consumer can detect partial scrapes by comparing `pagesFetched < pagesExpected`.
- `products`: MAY be an empty array (zero-product run is valid and preserved).

---

## ProductRecord Object

```json
{
  "brand":          "<string>",
  "strainName":     "<string>",
  "strainType":     "<string> | null",
  "thcValue":       <number> | null,
  "maxWeight":      "<string> | null",
  "priceAmount":    <integer> | null,
  "pricePrecision": <integer>,
  "priceCurrency":  "<string>"
}
```

### Constraints

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `brand` | string | No | Non-empty |
| `strainName` | string | No | Non-empty |
| `strainType` | string\|null | Yes | Omit or null if not available; never `"N/A"` |
| `thcValue` | number\|null | Yes | Float; e.g. `22.4`; null if not available |
| `maxWeight` | string\|null | Yes | E.g. `"1oz"`, `"3.5g"`; null if not available |
| `priceAmount` | integer\|null | Yes | Price in smallest unit (cents); e.g. `17500` = $175.00; null if not available |
| `pricePrecision` | integer | No | Always `2` for USD |
| `priceCurrency` | string | No | ISO 4217; always `"USD"` |

### Reconstructing Display Values

Consumers can reconstruct display strings without storing them:

```js
// Price: "$175.00"
const display = (priceAmount / Math.pow(10, pricePrecision)).toFixed(pricePrecision);
const price = priceCurrency === 'USD' ? `$${display}` : `${display} ${priceCurrency}`;

// THC: "22.4%"
const thc = thcValue != null ? `${thcValue}%` : '—';
```

---

## Versioning

This schema is unversioned for now. If the schema changes incompatibly in a future feature, a `schemaVersion` field will be added (absent = v1).

---

## Querying with AWS Athena

To query files stored under `runs/` using Athena:

```sql
CREATE EXTERNAL TABLE dispensary_snapshots (
  runId       STRING,
  date        STRING,
  startTime   STRING,
  productCount INT,
  pagesExpected INT,
  pagesFetched  INT,
  products ARRAY<STRUCT<
    brand:         STRING,
    strainName:    STRING,
    strainType:    STRING,
    thcValue:      DOUBLE,
    maxWeight:     STRING,
    priceAmount:   INT,
    pricePrecision: INT,
    priceCurrency: STRING
  >>
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://dispensary-scraper-data/runs/'
TBLPROPERTIES ('has_encrypted_data'='false');

-- Example: price trend for a strain over time
SELECT date,
       product.strainName,
       product.priceAmount / POWER(10.0, product.pricePrecision) AS price_usd
FROM dispensary_snapshots
CROSS JOIN UNNEST(products) AS t(product)
WHERE product.brand = 'Viola'
ORDER BY date;
```