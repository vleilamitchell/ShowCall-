Design an address feature for the application. This does not need a view. 

# Address Entity (U.S.-Specific)

## Identity & Linkage
- **address_id**: unique identifier  
- **entity_id**: links to person, company, or organization  
- **role**: billing, shipping, registered office, etc.  
- **valid_from** / **valid_to**: effective dates  
- **is_primary**: boolean flag  

## Core Address Fields
- **address_line_1**: street number + name (e.g., `123 Main St`)  
- **address_line_2**: apartment, suite, unit, building, floor (optional)  
- **city**: municipality (e.g., `Austin`)  
- **county**: county name (optional, useful in some jurisdictions)  
- **state**: two-letter USPS code (e.g., `TX`)  
- **zip_code**: 5-digit ZIP (e.g., `73301`)  
- **zip_plus4**: 4-digit extension (optional, e.g., `73301-1234`)  

## Geospatial & Standardization
- **latitude**  
- **longitude**  
- **usps_standardized**: normalized USPS format string  
- **raw_input**: original unparsed entry  

## Metadata & Compliance
- **created_at** / **updated_at**  
- **verified**: boolean (did USPS or other validator confirm?)  
- **verification_date**  
- **data_source**: manual, imported, API, etc.  
- **status**: active, inactive, pending_verification  