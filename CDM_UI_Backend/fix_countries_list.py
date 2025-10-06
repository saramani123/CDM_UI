#!/usr/bin/env python3
"""
Fix the countries list to include only the 195 UN-recognized countries.
This script will:
1. Delete all current countries
2. Add only the 195 UN-recognized countries
"""

import os
from dotenv import load_dotenv
from db import get_session

def fix_countries_list():
    """Replace all countries with only the 195 UN-recognized countries"""
    
    # Load environment variables
    load_dotenv()
    
    print("🌍 Fixing countries list to include only 195 UN-recognized countries...")
    print("=" * 70)
    
    # Get database session
    session = get_session()
    if not session:
        print("❌ Failed to connect to Neo4j database")
        return False
    
    try:
        # First, let's see what we currently have
        print("📊 Current country count:")
        result = session.run("MATCH (c:Country) RETURN count(c) as count")
        current_count = result.single()['count']
        print(f"  Current countries in database: {current_count}")
        
        # Delete all existing countries
        print("\n🗑️  Deleting all existing countries...")
        delete_result = session.run("MATCH (c:Country) DETACH DELETE c")
        deleted_count = delete_result.consume().counters.nodes_deleted
        print(f"  ✅ Deleted {deleted_count} countries")
        
        # 195 UN-recognized countries (ISO 3166-1 alpha-2)
        un_countries = [
            ("AD", "Andorra"), ("AE", "United Arab Emirates"), ("AF", "Afghanistan"),
            ("AG", "Antigua and Barbuda"), ("AL", "Albania"), ("AM", "Armenia"),
            ("AO", "Angola"), ("AR", "Argentina"), ("AT", "Austria"), ("AU", "Australia"),
            ("AZ", "Azerbaijan"), ("BA", "Bosnia and Herzegovina"), ("BB", "Barbados"),
            ("BD", "Bangladesh"), ("BE", "Belgium"), ("BF", "Burkina Faso"),
            ("BG", "Bulgaria"), ("BH", "Bahrain"), ("BI", "Burundi"), ("BJ", "Benin"),
            ("BN", "Brunei"), ("BO", "Bolivia"), ("BR", "Brazil"), ("BS", "Bahamas"),
            ("BT", "Bhutan"), ("BW", "Botswana"), ("BY", "Belarus"), ("BZ", "Belize"),
            ("CA", "Canada"), ("CD", "Democratic Republic of the Congo"), ("CF", "Central African Republic"),
            ("CG", "Republic of the Congo"), ("CH", "Switzerland"), ("CI", "Côte d'Ivoire"),
            ("CL", "Chile"), ("CM", "Cameroon"), ("CN", "China"), ("CO", "Colombia"),
            ("CR", "Costa Rica"), ("CU", "Cuba"), ("CV", "Cape Verde"), ("CY", "Cyprus"),
            ("CZ", "Czech Republic"), ("DE", "Germany"), ("DJ", "Djibouti"), ("DK", "Denmark"),
            ("DM", "Dominica"), ("DO", "Dominican Republic"), ("DZ", "Algeria"), ("EC", "Ecuador"),
            ("EE", "Estonia"), ("EG", "Egypt"), ("ER", "Eritrea"), ("ES", "Spain"),
            ("ET", "Ethiopia"), ("FI", "Finland"), ("FJ", "Fiji"), ("FM", "Micronesia"),
            ("FR", "France"), ("GA", "Gabon"), ("GB", "United Kingdom"), ("GD", "Grenada"),
            ("GE", "Georgia"), ("GH", "Ghana"), ("GM", "Gambia"), ("GN", "Guinea"),
            ("GQ", "Equatorial Guinea"), ("GR", "Greece"), ("GT", "Guatemala"), ("GW", "Guinea-Bissau"),
            ("GY", "Guyana"), ("HN", "Honduras"), ("HR", "Croatia"), ("HT", "Haiti"),
            ("HU", "Hungary"), ("ID", "Indonesia"), ("IE", "Ireland"), ("IL", "Israel"),
            ("IN", "India"), ("IQ", "Iraq"), ("IR", "Iran"), ("IS", "Iceland"),
            ("IT", "Italy"), ("JM", "Jamaica"), ("JO", "Jordan"), ("JP", "Japan"),
            ("KE", "Kenya"), ("KG", "Kyrgyzstan"), ("KH", "Cambodia"), ("KI", "Kiribati"),
            ("KM", "Comoros"), ("KN", "Saint Kitts and Nevis"), ("KP", "North Korea"), ("KR", "South Korea"),
            ("KW", "Kuwait"), ("KZ", "Kazakhstan"), ("LA", "Laos"), ("LB", "Lebanon"),
            ("LC", "Saint Lucia"), ("LI", "Liechtenstein"), ("LK", "Sri Lanka"), ("LR", "Liberia"),
            ("LS", "Lesotho"), ("LT", "Lithuania"), ("LU", "Luxembourg"), ("LV", "Latvia"),
            ("LY", "Libya"), ("MA", "Morocco"), ("MC", "Monaco"), ("MD", "Moldova"),
            ("ME", "Montenegro"), ("MG", "Madagascar"), ("MH", "Marshall Islands"), ("MK", "North Macedonia"),
            ("ML", "Mali"), ("MM", "Myanmar"), ("MN", "Mongolia"), ("MR", "Mauritania"),
            ("MT", "Malta"), ("MU", "Mauritius"), ("MV", "Maldives"), ("MW", "Malawi"),
            ("MX", "Mexico"), ("MY", "Malaysia"), ("MZ", "Mozambique"), ("NA", "Namibia"),
            ("NE", "Niger"), ("NG", "Nigeria"), ("NI", "Nicaragua"), ("NL", "Netherlands"),
            ("NO", "Norway"), ("NP", "Nepal"), ("NR", "Nauru"), ("NZ", "New Zealand"),
            ("OM", "Oman"), ("PA", "Panama"), ("PE", "Peru"), ("PG", "Papua New Guinea"),
            ("PH", "Philippines"), ("PK", "Pakistan"), ("PL", "Poland"), ("PT", "Portugal"),
            ("PW", "Palau"), ("PY", "Paraguay"), ("QA", "Qatar"), ("RO", "Romania"),
            ("RS", "Serbia"), ("RU", "Russia"), ("RW", "Rwanda"), ("SA", "Saudi Arabia"),
            ("SB", "Solomon Islands"), ("SC", "Seychelles"), ("SD", "Sudan"), ("SE", "Sweden"),
            ("SG", "Singapore"), ("SI", "Slovenia"), ("SK", "Slovakia"), ("SL", "Sierra Leone"),
            ("SM", "San Marino"), ("SN", "Senegal"), ("SO", "Somalia"), ("SR", "Suriname"),
            ("SS", "South Sudan"), ("ST", "São Tomé and Príncipe"), ("SV", "El Salvador"),
            ("SY", "Syria"), ("SZ", "Eswatini"), ("TD", "Chad"), ("TG", "Togo"),
            ("TH", "Thailand"), ("TJ", "Tajikistan"), ("TL", "Timor-Leste"), ("TM", "Turkmenistan"),
            ("TN", "Tunisia"), ("TO", "Tonga"), ("TR", "Turkey"), ("TT", "Trinidad and Tobago"),
            ("TV", "Tuvalu"), ("TZ", "Tanzania"), ("UA", "Ukraine"), ("UG", "Uganda"),
            ("US", "United States"), ("UY", "Uruguay"), ("UZ", "Uzbekistan"), ("VA", "Vatican City"),
            ("VC", "Saint Vincent and the Grenadines"), ("VE", "Venezuela"), ("VN", "Vietnam"),
            ("VU", "Vanuatu"), ("WS", "Samoa"), ("YE", "Yemen"), ("ZA", "South Africa"),
            ("ZM", "Zambia"), ("ZW", "Zimbabwe")
        ]
        
        print(f"\n🌍 Adding {len(un_countries)} UN-recognized countries...")
        
        # Add UN-recognized countries
        for code, name in un_countries:
            session.run("""
                MERGE (c:Country {code: $code, name: $name})
                SET c.created_at = datetime()
            """, code=code, name=name)
            print(f"  ✅ Added country: {name} ({code})")
        
        # Verify final count
        result = session.run("MATCH (c:Country) RETURN count(c) as count")
        final_count = result.single()['count']
        
        print(f"\n🎉 Successfully updated countries list!")
        print(f"📊 Final country count: {final_count}")
        
        if final_count == 195:
            print("✅ Perfect! Database now contains exactly 195 UN-recognized countries.")
        else:
            print(f"⚠️  Expected 195 countries, but found {final_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during countries fix: {e}")
        return False
    
    finally:
        session.close()

if __name__ == "__main__":
    print("🌍 Fix Countries List Script")
    print("This will replace all countries with only the 195 UN-recognized countries")
    print("Proceeding with countries fix...")
    
    try:
        success = fix_countries_list()
        
        if success:
            print("\n🎉 Countries fix completed successfully!")
        else:
            print("\n💥 Countries fix failed. Please check the error messages above.")
            
    except KeyboardInterrupt:
        print("\n❌ Countries fix cancelled by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
