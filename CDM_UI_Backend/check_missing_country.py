#!/usr/bin/env python3
"""
Check which country might be missing from the 195 UN-recognized countries.
"""

import os
from dotenv import load_dotenv
from db import get_session

def check_missing_country():
    """Check which country is missing from the 195 UN-recognized countries"""
    
    # Load environment variables
    load_dotenv()
    
    print("🔍 Checking for missing country...")
    print("=" * 50)
    
    # Get database session
    session = get_session()
    if not session:
        print("❌ Failed to connect to Neo4j database")
        return False
    
    try:
        # Get all countries currently in database
        result = session.run("MATCH (c:Country) RETURN c.code as code, c.name as name ORDER BY c.name")
        current_countries = [(record['code'], record['name']) for record in result]
        
        print(f"📊 Current countries in database: {len(current_countries)}")
        
        # The complete list of 195 UN-recognized countries
        all_195_countries = [
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
        
        print(f"📊 Expected countries: {len(all_195_countries)}")
        
        # Find missing countries
        current_codes = {code for code, name in current_countries}
        expected_codes = {code for code, name in all_195_countries}
        
        missing_codes = expected_codes - current_codes
        extra_codes = current_codes - expected_codes
        
        if missing_codes:
            print(f"\n❌ Missing countries: {missing_codes}")
            for code in missing_codes:
                name = next(name for c, name in all_195_countries if c == code)
                print(f"  - {name} ({code})")
        else:
            print("\n✅ No missing countries found")
        
        if extra_codes:
            print(f"\n⚠️  Extra countries: {extra_codes}")
            for code in extra_codes:
                name = next(name for c, name in current_countries if c == code)
                print(f"  - {name} ({code})")
        else:
            print("\n✅ No extra countries found")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during check: {e}")
        return False
    
    finally:
        session.close()

if __name__ == "__main__":
    print("🔍 Check Missing Country Script")
    print("This will identify which country is missing from the 195 UN-recognized countries")
    print("Proceeding with check...")
    
    try:
        success = check_missing_country()
        
        if success:
            print("\n🎉 Check completed successfully!")
        else:
            print("\n💥 Check failed. Please check the error messages above.")
            
    except KeyboardInterrupt:
        print("\n❌ Check cancelled by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
