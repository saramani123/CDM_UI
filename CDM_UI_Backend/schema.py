"""
Neo4j schema setup for CDM_U project
Creates nodes and relationships for Objects, Variables, Lists, and Drivers
"""

from db import get_driver
from pydantic import BaseModel, Field
from typing import List, Optional

# ObjectRelationshipCreateRequest class definition
class ObjectRelationshipCreateRequest(BaseModel):
    relationship_type: Optional[str] = "HAS_SPECIFIC_VARIABLE"  # HAS_SPECIFIC_VARIABLE or HAS_VARIABLE
    to_sector: Optional[str] = ""
    to_domain: Optional[str] = ""
    to_country: Optional[str] = ""
    to_object_clarifier: Optional[str] = ""
    to_being: str
    to_avatar: str
    to_object: str

def create_constraints_and_indexes():
    """Create constraints and indexes for the CDM schema"""
    driver = get_driver()
    if not driver:
        print("No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Create constraints for unique IDs and driver names
            constraints = [
                "CREATE CONSTRAINT object_id_unique IF NOT EXISTS FOR (o:Object) REQUIRE o.id IS UNIQUE",
                "CREATE CONSTRAINT variable_id_unique IF NOT EXISTS FOR (v:Variable) REQUIRE v.id IS UNIQUE", 
                "CREATE CONSTRAINT list_id_unique IF NOT EXISTS FOR (l:List) REQUIRE l.id IS UNIQUE",
                "CREATE CONSTRAINT sector_name_unique IF NOT EXISTS FOR (s:Sector) REQUIRE s.name IS UNIQUE",
                "CREATE CONSTRAINT domain_name_unique IF NOT EXISTS FOR (d:Domain) REQUIRE d.name IS UNIQUE",
                "CREATE CONSTRAINT country_name_unique IF NOT EXISTS FOR (c:Country) REQUIRE c.name IS UNIQUE",
                "CREATE CONSTRAINT object_clarifier_name_unique IF NOT EXISTS FOR (oc:ObjectClarifier) REQUIRE oc.name IS UNIQUE",
                "CREATE CONSTRAINT variable_clarifier_name_unique IF NOT EXISTS FOR (vc:VariableClarifier) REQUIRE vc.name IS UNIQUE",
                # Objects taxonomy constraints
                "CREATE CONSTRAINT being_name_unique IF NOT EXISTS FOR (b:Being) REQUIRE b.name IS UNIQUE",
                "CREATE CONSTRAINT avatar_name_unique IF NOT EXISTS FOR (a:Avatar) REQUIRE a.name IS UNIQUE",
                # Removed global unique constraint on variant names - variants can have same name for different objects
                "CREATE CONSTRAINT object_name_unique IF NOT EXISTS FOR (o:Object) REQUIRE o.name IS UNIQUE",
                # Variables taxonomy constraints
                "CREATE CONSTRAINT part_name_unique IF NOT EXISTS FOR (p:Part) REQUIRE p.name IS UNIQUE",
                "CREATE CONSTRAINT group_name_unique IF NOT EXISTS FOR (g:Group) REQUIRE g.name IS UNIQUE",
                # Relationship and Variant constraints
                "CREATE CONSTRAINT relationship_id_unique IF NOT EXISTS FOR (r:Relationship) REQUIRE r.id IS UNIQUE",
                "CREATE CONSTRAINT variant_id_unique IF NOT EXISTS FOR (v:Variant) REQUIRE v.id IS UNIQUE"
            ]
            
            for constraint in constraints:
                try:
                    session.run(constraint)
                    print(f"✅ Created constraint: {constraint.split('FOR')[1].split('REQUIRE')[0].strip()}")
                except Exception as e:
                    print(f"⚠️  Constraint may already exist: {e}")
            
            # Create indexes for better query performance
            indexes = [
                "CREATE INDEX object_driver_index IF NOT EXISTS FOR (o:Object) ON (o.driver)",
                "CREATE INDEX object_being_index IF NOT EXISTS FOR (o:Object) ON (o.being)",
                "CREATE INDEX object_avatar_index IF NOT EXISTS FOR (o:Object) ON (o.avatar)",
                "CREATE INDEX variable_driver_index IF NOT EXISTS FOR (v:Variable) ON (v.driver)",
                "CREATE INDEX variable_part_index IF NOT EXISTS FOR (v:Variable) ON (v.part)",
                "CREATE INDEX list_driver_index IF NOT EXISTS FOR (l:List) ON (l.driver)",
                "CREATE INDEX list_set_index IF NOT EXISTS FOR (l:List) ON (l.set)",
                "CREATE INDEX sector_name_index IF NOT EXISTS FOR (s:Sector) ON (s.name)",
                "CREATE INDEX domain_name_index IF NOT EXISTS FOR (d:Domain) ON (d.name)",
                "CREATE INDEX country_name_index IF NOT EXISTS FOR (c:Country) ON (c.name)",
                "CREATE INDEX object_clarifier_name_index IF NOT EXISTS FOR (oc:ObjectClarifier) ON (oc.name)",
                "CREATE INDEX variable_clarifier_name_index IF NOT EXISTS FOR (vc:VariableClarifier) ON (vc.name)",
                # Objects taxonomy indexes
                "CREATE INDEX being_name_index IF NOT EXISTS FOR (b:Being) ON (b.name)",
                "CREATE INDEX avatar_name_index IF NOT EXISTS FOR (a:Avatar) ON (a.name)",
                "CREATE INDEX variant_name_index IF NOT EXISTS FOR (v:Variant) ON (v.name)",
                "CREATE INDEX object_name_index IF NOT EXISTS FOR (o:Object) ON (o.name)",
                # Variables taxonomy indexes
                "CREATE INDEX part_name_index IF NOT EXISTS FOR (p:Part) ON (p.name)",
                "CREATE INDEX group_name_index IF NOT EXISTS FOR (g:Group) ON (g.name)",
                # Relationship and Variant indexes
                "CREATE INDEX relationship_type_index IF NOT EXISTS FOR (r:Relationship) ON (r.type)",
                "CREATE INDEX relationship_role_index IF NOT EXISTS FOR (r:Relationship) ON (r.role)",
                "CREATE INDEX variant_name_index IF NOT EXISTS FOR (v:Variant) ON (v.name)"
            ]
            
            for index in indexes:
                try:
                    session.run(index)
                    print(f"✅ Created index: {index.split('ON')[1].strip()}")
                except Exception as e:
                    print(f"⚠️  Index may already exist: {e}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error creating constraints and indexes: {e}")
            return False

def seed_countries():
    """Seed all world countries as pre-defined nodes"""
    driver = get_driver()
    if not driver:
        print("No Neo4j connection available")
        return False
    
    # List of all world countries
    countries = [
        "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
        "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
        "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon",
        "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
        "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
        "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia",
        "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti",
        "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
        "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "North Korea", "South Korea", "Kuwait", "Kyrgyzstan",
        "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macedonia",
        "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico",
        "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
        "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Norway", "Oman", "Pakistan", "Palau",
        "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia",
        "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia",
        "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Sudan", "Spain",
        "Sri Lanka", "Sudan", "Suriname", "Swaziland", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania",
        "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
        "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen",
        "Zambia", "Zimbabwe"
    ]
    
    with driver.session() as session:
        try:
            # Check if countries already exist
            existing_countries = session.run("MATCH (c:Country) RETURN count(c) as count").single()
            if existing_countries and existing_countries["count"] > 0:
                print("⚠️  Countries already exist, skipping country seeding")
                return True
            
            # Clear existing countries first
            session.run("MATCH (c:Country) DETACH DELETE c")
            print("🗑️  Cleared existing countries")
            
            # Create all countries
            for country in countries:
                session.run("CREATE (c:Country {name: $name})", name=country)
            
            print(f"✅ Seeded {len(countries)} countries")
            return True
            
        except Exception as e:
            print(f"❌ Error seeding countries: {e}")
            return False

def seed_objects_taxonomy():
    """Seed the basic Objects taxonomy structure (Being, Avatar, Object, Variant)"""
    driver = get_driver()
    if not driver:
        print("No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Clear existing taxonomy
            session.run("MATCH (b:Being) DETACH DELETE b")
            session.run("MATCH (a:Avatar) DETACH DELETE a")
            session.run("MATCH (o:Object) DETACH DELETE o")
            session.run("MATCH (v:Variant) DETACH DELETE v")
            print("🗑️  Cleared existing Objects taxonomy")
            
            # Create Beings
            beings = ['Master', 'Mate', 'Process', 'Adjunct', 'Rule', 'Roster']
            for being in beings:
                session.run("CREATE (b:Being {name: $name})", name=being)
            print(f"✅ Created {len(beings)} Beings")
            
            # Create Avatars with their Being relationships
            avatar_data = [
                # Master avatars
                ('Master', 'Company'),
                ('Master', 'Company Affiliate'),
                ('Master', 'Employee'),
                ('Master', 'Product'),
                ('Master', 'Customer'),
                ('Master', 'Supplier'),
                # Mate avatars
                ('Mate', 'Person'),
                ('Mate', 'Thing'),
                ('Mate', 'Reference'),
                ('Mate', 'Register'),
                # Process avatars
                ('Process', 'Activity'),
                ('Process', 'Transaction'),
                ('Process', 'Payment'),
                ('Process', 'Posting'),
                # Adjunct avatars
                ('Adjunct', 'Account'),
                ('Adjunct', 'Attribute'),
                # Rule avatars
                ('Rule', 'Trigger'),
                ('Rule', 'Validator'),
                # Roster avatars
                ('Roster', 'List')
            ]
            
            for being_name, avatar_name in avatar_data:
                # Create Avatar
                session.run("CREATE (a:Avatar {name: $name})", name=avatar_name)
                # Create relationship
                session.run("""
                    MATCH (b:Being {name: $being_name})
                    MATCH (a:Avatar {name: $avatar_name})
                    CREATE (b)-[:HAS_AVATAR]->(a)
                """, being_name=being_name, avatar_name=avatar_name)
            
            print(f"✅ Created {len(avatar_data)} Avatars with Being relationships")
            
            return True
            
        except Exception as e:
            print(f"❌ Error seeding Objects taxonomy: {e}")
            return False

def create_sample_data():
    """Create sample data for testing (excluding drivers - they will be managed via UI)"""
    driver = get_driver()
    if not driver:
        print("No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Check if objects already exist to avoid conflicts
            existing_objects = session.run("MATCH (o:Object) RETURN count(o) as count").single()
            if existing_objects and existing_objects["count"] > 0:
                print("⚠️  Objects already exist, skipping sample data creation")
                return True
            
            # Create sample Objects only if none exist
            objects_query = """
            UNWIND [
                {
                    id: '1',
                    driver: 'ALL, ALL, ALL, Employment Type',
                    being: 'Master',
                    avatar: 'Company',
                    object: 'Company',
                    relationships: 13,
                    variants: 23,
                    variables: 54,
                    status: 'Active'
                },
                {
                    id: '2', 
                    driver: 'ALL, ALL, ALL, Pay Type',
                    being: 'Master',
                    avatar: 'Company Affiliate',
                    object: 'Entity',
                    relationships: 1,
                    variants: 2,
                    variables: 45,
                    status: 'Active'
                }
            ] AS obj
            CREATE (o:Object)
            SET o = obj
            """
            
            session.run(objects_query)
            print("✅ Created sample Objects")
            
            # Create sample Variables
            variables_query = """
            UNWIND [
                {
                    id: '1',
                    driver: '***, ***, ***, ***',
                    clarifier: 'ANY',
                    part: 'Identifier',
                    section: 'CDM',
                    group: '[Identifier]',
                    variable: '[Identifier]',
                    formatI: 'Special',
                    formatII: 'Custom',
                    gType: 'Loose',
                    validation: 'Length',
                    default: '',
                    graph: 'Y',
                    objectRelationships: 2,
                    status: 'Active'
                },
                {
                    id: '2',
                    driver: '***, ***, ***, ***',
                    clarifier: 'ANY',
                    part: 'Identifier',
                    section: 'CDM',
                    group: '[Identifier]',
                    variable: '[Identifier] #',
                    formatI: 'List',
                    formatII: 'Static',
                    gType: 'Loose',
                    validation: '',
                    default: '',
                    graph: '',
                    objectRelationships: 1,
                    status: 'Active'
                }
            ] AS var
            CREATE (v:Variable)
            SET v = var
            """
            
            session.run(variables_query)
            print("✅ Created sample Variables")
            
            # Create sample Lists
            lists_query = """
            UNWIND [
                {
                    id: '1',
                    driver: '***, ***, ***, ***',
                    objectType: '*',
                    clarifier: '*',
                    variable: '*',
                    set: 'Flag',
                    grouping: '-',
                    list: 'Boolean',
                    status: 'Active'
                },
                {
                    id: '2',
                    driver: '***, ***, ***, ***',
                    objectType: '*',
                    clarifier: '*',
                    variable: 'Is (*)',
                    set: 'Flag',
                    grouping: '-',
                    list: 'Boolean Is',
                    status: 'Active'
                }
            ] AS list_data
            CREATE (l:List)
            SET l = list_data
            """
            
            session.run(lists_query)
            print("✅ Created sample Lists")
            
            return True
            
        except Exception as e:
            print(f"❌ Error creating sample data: {e}")
            return False

def setup_schema():
    """Set up the complete CDM schema"""
    print("Setting up CDM Neo4j schema...")
    
    if create_constraints_and_indexes():
        print("✅ Constraints and indexes created successfully")
    else:
        print("❌ Failed to create constraints and indexes")
        return False
    
    if seed_countries():
        print("✅ Countries seeded successfully")
    else:
        print("❌ Failed to seed countries")
        return False
    
    if seed_objects_taxonomy():
        print("✅ Objects taxonomy seeded successfully")
    else:
        print("❌ Failed to seed Objects taxonomy")
        return False
    
    if create_sample_data():
        print("✅ Sample data created successfully")
    else:
        print("❌ Failed to create sample data")
        return False
    
    print("🎉 CDM schema setup complete!")
    return True

# Pydantic Models for API Validation
class ObjectCreateRequest(BaseModel):
    sector: List[str] = Field(..., description="List of sectors")
    domain: List[str] = Field(..., description="List of domains")
    country: List[str] = Field(..., description="List of countries")
    objectClarifier: Optional[str] = Field(None, description="Object clarifier")
    being: str = Field(..., description="Being type")
    avatar: str = Field(..., description="Avatar type")
    object: str = Field(..., description="Object name")
    variants: Optional[List[str]] = Field(default=[], description="List of variants")
    relationships: Optional[List[dict]] = Field(default=[], description="List of relationships")
    status: Optional[str] = Field(default="Active", description="Object status")

class ObjectResponse(BaseModel):
    id: str
    driver: str
    being: str
    avatar: str
    object: str
    status: str
    relationships: int = 0
    variants: int = 0
    variables: int = 0
    relationshipsList: List[dict] = []
    variantsList: List[dict] = []

class CSVRowData(BaseModel):
    """Schema for validating individual CSV rows"""
    Sector: str = Field(..., description="Sector name or 'ALL'")
    Domain: str = Field(..., description="Domain name or 'ALL'")
    Country: str = Field(..., description="Country name or 'ALL'")
    ObjectClarifier: Optional[str] = Field(None, alias="Object Clarifier", description="Object clarifier or None")
    Being: str = Field(..., description="Being type")
    Avatar: str = Field(..., description="Avatar type")
    Object: str = Field(..., description="Object name")
    
    class Config:
        populate_by_name = True

# Variable Models
class VariableCreateRequest(BaseModel):
    """Schema for creating a new variable"""
    driver: str = Field(..., description="Concatenated driver string")
    part: str = Field(..., description="Part type")
    group: str = Field(..., description="Group name")
    section: str = Field(..., description="Section name")
    variable: str = Field(..., description="Variable name")
    formatI: str = Field(..., description="Format I")
    formatII: str = Field(..., description="Format II")
    gType: Optional[str] = Field("", description="G-Type")
    validation: Optional[str] = Field("", description="Validation rules")
    default: Optional[str] = Field("", description="Default value")
    graph: Optional[str] = Field("Y", description="Graph inclusion (Y/N)")
    status: Optional[str] = Field("Active", description="Status")

class VariableUpdateRequest(BaseModel):
    """Schema for updating a variable - all fields optional for partial updates"""
    driver: Optional[str] = None
    part: Optional[str] = None
    group: Optional[str] = None
    section: Optional[str] = None
    variable: Optional[str] = None
    formatI: Optional[str] = None
    formatII: Optional[str] = None
    gType: Optional[str] = None
    validation: Optional[str] = None
    default: Optional[str] = None
    graph: Optional[str] = None
    status: Optional[str] = None

class BulkVariableUpdateRequest(BaseModel):
    """Schema for bulk updating variables"""
    variable_ids: List[str] = Field(..., description="List of variable IDs to update")
    driver: Optional[str] = None
    part: Optional[str] = None
    group: Optional[str] = None
    section: Optional[str] = None
    variable: Optional[str] = None
    formatI: Optional[str] = None
    formatII: Optional[str] = None
    gType: Optional[str] = None
    validation: Optional[str] = None
    default: Optional[str] = None
    graph: Optional[str] = None
    status: Optional[str] = None
    objectRelationshipsList: Optional[List[ObjectRelationshipCreateRequest]] = None
    shouldOverrideRelationships: Optional[bool] = False  # If true, delete existing relationships before creating new ones

class BulkVariableUpdateResponse(BaseModel):
    """Schema for bulk variable update response"""
    success: bool
    message: str
    updated_count: int
    error_count: int
    errors: List[str] = []

class VariableResponse(BaseModel):
    """Schema for variable response"""
    id: str
    driver: str
    part: str
    group: str
    section: str
    variable: str
    formatI: str
    formatII: str
    gType: str
    validation: str
    default: str
    graph: str
    status: str
    objectRelationships: int
    objectRelationshipsList: List[dict] = []

class VariableCSVRowData(BaseModel):
    """Schema for a single CSV row for variable upload"""
    Sector: str = Field(..., description="Sector name or 'ALL'")
    Domain: str = Field(..., description="Domain name or 'ALL'")
    Country: str = Field(..., description="Country name or 'ALL'")
    VariableClarifier: Optional[str] = Field(None, alias="Variable Clarifier", description="Variable clarifier or None")
    Part: str = Field(..., description="Part type")
    Group: str = Field(..., description="Group name")
    Section: str = Field(..., description="Section name")
    Variable: str = Field(..., description="Variable name")
    FormatI: str = Field(..., alias="Format I", description="Format I")
    FormatII: str = Field(..., alias="Format II", description="Format II")
    GType: Optional[str] = Field("", alias="G-Type", description="G-Type")
    Validation: Optional[str] = Field("", description="Validation rules")
    Default: Optional[str] = Field("", description="Default value")
    Graph: Optional[str] = Field("Y", description="Graph inclusion (Y/N)")
    
    class Config:
        allow_population_by_field_name = True
        populate_by_name = True

class VariableFieldOptionRequest(BaseModel):
    """Schema for adding a new field option"""
    field_name: str = Field(..., description="Field name (formatI, formatII, gType, validation, default)")
    value: str = Field(..., description="New value to add")

class VariableFieldOptionsResponse(BaseModel):
    """Schema for variable field options response"""
    formatI: List[str]
    formatII: List[str]
    gType: List[str]
    validation: List[str]
    default: List[str]

class CSVUploadRequest(BaseModel):
    """Schema for CSV upload validation"""
    rows: List[CSVRowData] = Field(..., description="List of CSV rows")

class CSVUploadResponse(BaseModel):
    success: bool
    message: str
    created_count: int
    error_count: int
    errors: List[str] = []
    created_objects: List[dict] = []

if __name__ == "__main__":
    setup_schema()
