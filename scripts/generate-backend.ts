/**
 * Sends a detailed spec to Claude and asks it to write the Flask backend.
 * Run with: npx tsx scripts/generate-backend.ts
 *
 * Install tsx first if needed: npm install -D tsx
 * Set your API key: export ANTHROPIC_API_KEY=sk-...
 */

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync } from 'fs'

const client = new Anthropic()

const PROMPT = `
You are a senior Python backend engineer. Build a Flask REST API server for an agrivoltaic
(permaculture + photovoltaic) field planning tool. The frontend is already built in React and
will call these exact endpoints on localhost:5000.

---

## Tech Stack

- Python 3.11+
- Flask (REST API, CORS enabled for localhost:5173)
- GeoPandas + Shapely (field layout geometry)
- pandas + numpy (calculations)
- Return everything as JSON

---

## Data Models

### Plant (returned from /all_plants)
{
  "id": "string",
  "name": "string",
  "companion_plants": ["plant_id"],         // IDs of plants that grow well together
  "antagonistic_plants": ["plant_id"],      // IDs of plants that should NOT be adjacent
  "general_sum": "string",                  // short description
  "planting_season": "string",
  "harvesting_season": "string",
  "water_needs": "low" | "medium" | "high",
  "sun_needs": "full_sun" | "partial_shade" | "full_shade",
  "flowering_season": "string",
  "height": 0.5,                            // meters (float)
  "spread": 0.3                             // meters (float)
}

### Field Dimensions
{ "length": 100, "width": 50 }  // meters. length = east-west axis, width = north-south axis

### PV System Config (sent by user in /make_agrivoltaic_garden)
{
  "pv_production": 10.5,    // kW (validated against min/max range)
  "battery_size": 20,       // kWh
  "system_height": 3.0,     // meters — height of PV panels above ground
  "north_coordinate": 52.5  // latitude in decimal degrees — for shadow calculation
}

### GeoJSON Feature properties (returned in /make_agrivoltaic_garden)
Each feature must have a "type" property:
  - "plant_row"  → also include: row_index (int), plants (list of plant names)
  - "pv_row"     → also include: row_index (int), kw (float — this row's share of pv_production)
  - "gap"        → no extra properties needed

---

## Endpoints

### 1. GET /all_plants
Returns a hardcoded or file-loaded list of at least 12 diverse permaculture plants.
Include a realistic mix of vegetables, herbs, and fruit plants.
Each plant must have all fields from the Plant model above.
Make sure companion_plants and antagonistic_plants reference real IDs in the list.

Response: Plant[]


### 2. POST /calculate_min_max_pv
Body: { "length": number, "width": number }

Calculate the minimum and maximum installable PV system size for this field.

Rules:
- The field has rows running EAST-WEST.
- Each plant row is 2 m wide (north-south), followed by a 0.5 m tractor gap.
- PV rows also run east-west. The first PV row is at the southern edge of the field.
- Shadow calculation: given system_height H and latitude φ, the shadow length at winter
  solstice noon = H / tan(altitude_angle), where:
    altitude_angle = 90° - φ + 23.5°   (sun's altitude at solar noon on Dec 21)
  The gap between PV rows = 2 × shadow_length (to avoid shading the next row).
- Min PV: 1 PV row that fits at the southern edge.
- Max PV: as many PV rows as fit with the required shadow gaps between them.
- Use a default system_height=3.0 m and north_coordinate=48.0° (central Europe default)
  for this pre-calculation since the user hasn't filled step 3 yet.
- Convert total PV row area to kW using a standard yield of 0.15 kW per m² of panel.
  Assume each PV row is 2 m deep (north-south) × field_length (east-west).

Response: { "min_kw": float, "max_kw": float }


### 3. POST /make_agrivoltaic_garden
Body:
{
  "field": { "length": number, "width": number },
  "selected_plant_ids": ["id1", "id2", ...],
  "pv_system": {
    "pv_production": number,
    "battery_size": number,
    "system_height": number,
    "north_coordinate": number
  }
}

This is the main calculation endpoint. It should:

1. SHADOW CALCULATION:
   - Compute shadow length using the actual north_coordinate and system_height from the body.
   - shadow_length = system_height / tan(altitude_angle)
   - altitude_angle = 90° - north_coordinate + 23.5° (in radians for math.tan)
   - Gap between PV rows = 2 × shadow_length

2. PV ROW PLACEMENT:
   - Place PV rows from the southern edge (y=0) northward.
   - Each PV row occupies 2 m (north-south). After each PV row, leave a gap of 2×shadow_length.
   - Count how many PV rows fit: keep adding (2 + 2×shadow_length) until y > field_width.
   - Distribute pv_production evenly across all PV rows.

3. PLANT ROW PLACEMENT:
   - Fill remaining space between PV rows with plant rows (2 m wide) and tractor gaps (0.5 m).
   - Group companion plants together in the same row segment. Avoid placing antagonistic plants
     in adjacent rows where possible.
   - Each plant row polygon covers the full east-west length of the field.
   - Assign plants to rows based on companion groupings (use a simple greedy grouping).

4. BUILD GeoDataFrame:
   - Create a GeoPandas GeoDataFrame where each row is a Shapely Polygon.
   - Coordinate system: local meters. Origin (0,0) = SW corner of field.
     X axis = east-west (0 to field_length).
     Y axis = south-north (0 to field_width).
   - Each polygon: Shapely box(x_min, y_min, x_max, y_max)
   - Feature types: "plant_row", "pv_row", "gap"

5. RETURN GeoJSON:
   - Return gdf.__geo_interface__ (or gdf.to_json()) as a GeoJSON FeatureCollection.
   - Each Feature must have "properties" with at minimum a "type" field.
   - plant_row properties: { "type": "plant_row", "row_index": int, "plants": [str] }
   - pv_row properties:    { "type": "pv_row",    "row_index": int, "kw": float }
   - gap properties:       { "type": "gap" }

Response: GeoJSON FeatureCollection (application/json)

---

## Code Requirements

- Single file: server.py
- Use Flask-CORS to allow requests from http://localhost:5173
- Add a /health GET endpoint that returns { "status": "ok" }
- Use proper HTTP status codes (400 for bad input, 500 for server errors)
- Add brief comments explaining the shadow calculation math
- All floating-point values rounded to 2 decimal places in responses
- Include a requirements.txt with pinned versions

---

Write the complete server.py and requirements.txt. No placeholders — fully working code.
`

async function main() {
  console.log('Sending spec to Claude Opus 4.6...\n')

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: PROMPT }],
  })

  let fullText = ''

  stream.on('text', (delta) => {
    process.stdout.write(delta)
    fullText += delta
  })

  await stream.finalMessage()

  // Save the full response to a file for reference
  writeFileSync('scripts/backend-spec-response.md', fullText)
  console.log('\n\n✓ Full response saved to scripts/backend-spec-response.md')
}

main().catch(console.error)
