"""
Neo4j schema setup for CDM_U project
Creates nodes and relationships for Objects, Variables, Lists, and Drivers
"""

from db import get_driver

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
                "CREATE CONSTRAINT variable_clarifier_name_unique IF NOT EXISTS FOR (vc:VariableClarifier) REQUIRE vc.name IS UNIQUE"
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
                "CREATE INDEX variable_clarifier_name_index IF NOT EXISTS FOR (vc:VariableClarifier) ON (vc.name)"
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

def create_sample_data():
    """Create sample data for testing (excluding drivers - they will be managed via UI)"""
    driver = get_driver()
    if not driver:
        print("No Neo4j connection available")
        return False
    
    with driver.session() as session:
        try:
            # Create sample Objects
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
    
    if create_sample_data():
        print("✅ Sample data created successfully")
    else:
        print("❌ Failed to create sample data")
        return False
    
    print("🎉 CDM schema setup complete!")
    return True

if __name__ == "__main__":
    setup_schema()
