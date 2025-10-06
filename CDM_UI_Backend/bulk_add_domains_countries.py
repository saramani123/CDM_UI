#!/usr/bin/env python3
"""
Bulk add domains and ISO countries to Neo4j database.
This script will add:
- 20 domains (Accounting, Finance, Procurement, etc.)
- Standard ISO list of countries
"""

import os
from dotenv import load_dotenv
from db import get_session

def add_domains_and_countries():
    """Add domains and ISO countries to Neo4j database"""
    
    # Load environment variables
    load_dotenv()
    
    print("🚀 Adding domains and ISO countries to Neo4j...")
    print("=" * 50)
    
    # Get database session
    session = get_session()
    if not session:
        print("❌ Failed to connect to Neo4j database")
        return False
    
    try:
        # List of domains to add
        domains = [
            "Accounting", "Finance", "Procurement", "Sales", "Customer",
            "Supplier", "Inventory", "Product", "Employee", "Compliance",
            "Legal", "Risk", "Operations", "IT", "Marketing",
            "Manufacturing", "Service", "Tax", "Audit", "Projects"
        ]
        
        # ISO 3166-1 alpha-2 country codes and names
        countries = [
            ("AD", "Andorra"), ("AE", "United Arab Emirates"), ("AF", "Afghanistan"),
            ("AG", "Antigua and Barbuda"), ("AI", "Anguilla"), ("AL", "Albania"),
            ("AM", "Armenia"), ("AO", "Angola"), ("AQ", "Antarctica"), ("AR", "Argentina"),
            ("AS", "American Samoa"), ("AT", "Austria"), ("AU", "Australia"),
            ("AW", "Aruba"), ("AX", "Åland Islands"), ("AZ", "Azerbaijan"),
            ("BA", "Bosnia and Herzegovina"), ("BB", "Barbados"), ("BD", "Bangladesh"),
            ("BE", "Belgium"), ("BF", "Burkina Faso"), ("BG", "Bulgaria"),
            ("BH", "Bahrain"), ("BI", "Burundi"), ("BJ", "Benin"),
            ("BL", "Saint Barthélemy"), ("BM", "Bermuda"), ("BN", "Brunei"),
            ("BO", "Bolivia"), ("BQ", "Caribbean Netherlands"), ("BR", "Brazil"),
            ("BS", "Bahamas"), ("BT", "Bhutan"), ("BV", "Bouvet Island"),
            ("BW", "Botswana"), ("BY", "Belarus"), ("BZ", "Belize"),
            ("CA", "Canada"), ("CC", "Cocos Islands"), ("CD", "Democratic Republic of the Congo"),
            ("CF", "Central African Republic"), ("CG", "Republic of the Congo"),
            ("CH", "Switzerland"), ("CI", "Côte d'Ivoire"), ("CK", "Cook Islands"),
            ("CL", "Chile"), ("CM", "Cameroon"), ("CN", "China"),
            ("CO", "Colombia"), ("CR", "Costa Rica"), ("CU", "Cuba"),
            ("CV", "Cape Verde"), ("CW", "Curaçao"), ("CX", "Christmas Island"),
            ("CY", "Cyprus"), ("CZ", "Czech Republic"), ("DE", "Germany"),
            ("DJ", "Djibouti"), ("DK", "Denmark"), ("DM", "Dominica"),
            ("DO", "Dominican Republic"), ("DZ", "Algeria"), ("EC", "Ecuador"),
            ("EE", "Estonia"), ("EG", "Egypt"), ("EH", "Western Sahara"),
            ("ER", "Eritrea"), ("ES", "Spain"), ("ET", "Ethiopia"),
            ("FI", "Finland"), ("FJ", "Fiji"), ("FK", "Falkland Islands"),
            ("FM", "Micronesia"), ("FO", "Faroe Islands"), ("FR", "France"),
            ("GA", "Gabon"), ("GB", "United Kingdom"), ("GD", "Grenada"),
            ("GE", "Georgia"), ("GF", "French Guiana"), ("GG", "Guernsey"),
            ("GH", "Ghana"), ("GI", "Gibraltar"), ("GL", "Greenland"),
            ("GM", "Gambia"), ("GN", "Guinea"), ("GP", "Guadeloupe"),
            ("GQ", "Equatorial Guinea"), ("GR", "Greece"), ("GS", "South Georgia"),
            ("GT", "Guatemala"), ("GU", "Guam"), ("GW", "Guinea-Bissau"),
            ("GY", "Guyana"), ("HK", "Hong Kong"), ("HM", "Heard Island"),
            ("HN", "Honduras"), ("HR", "Croatia"), ("HT", "Haiti"),
            ("HU", "Hungary"), ("ID", "Indonesia"), ("IE", "Ireland"),
            ("IL", "Israel"), ("IM", "Isle of Man"), ("IN", "India"),
            ("IO", "British Indian Ocean Territory"), ("IQ", "Iraq"), ("IR", "Iran"),
            ("IS", "Iceland"), ("IT", "Italy"), ("JE", "Jersey"),
            ("JM", "Jamaica"), ("JO", "Jordan"), ("JP", "Japan"),
            ("KE", "Kenya"), ("KG", "Kyrgyzstan"), ("KH", "Cambodia"),
            ("KI", "Kiribati"), ("KM", "Comoros"), ("KN", "Saint Kitts and Nevis"),
            ("KP", "North Korea"), ("KR", "South Korea"), ("KW", "Kuwait"),
            ("KY", "Cayman Islands"), ("KZ", "Kazakhstan"), ("LA", "Laos"),
            ("LB", "Lebanon"), ("LC", "Saint Lucia"), ("LI", "Liechtenstein"),
            ("LK", "Sri Lanka"), ("LR", "Liberia"), ("LS", "Lesotho"),
            ("LT", "Lithuania"), ("LU", "Luxembourg"), ("LV", "Latvia"),
            ("LY", "Libya"), ("MA", "Morocco"), ("MC", "Monaco"),
            ("MD", "Moldova"), ("ME", "Montenegro"), ("MF", "Saint Martin"),
            ("MG", "Madagascar"), ("MH", "Marshall Islands"), ("MK", "North Macedonia"),
            ("ML", "Mali"), ("MM", "Myanmar"), ("MN", "Mongolia"),
            ("MO", "Macau"), ("MP", "Northern Mariana Islands"), ("MQ", "Martinique"),
            ("MR", "Mauritania"), ("MS", "Montserrat"), ("MT", "Malta"),
            ("MU", "Mauritius"), ("MV", "Maldives"), ("MW", "Malawi"),
            ("MX", "Mexico"), ("MY", "Malaysia"), ("MZ", "Mozambique"),
            ("NA", "Namibia"), ("NC", "New Caledonia"), ("NE", "Niger"),
            ("NF", "Norfolk Island"), ("NG", "Nigeria"), ("NI", "Nicaragua"),
            ("NL", "Netherlands"), ("NO", "Norway"), ("NP", "Nepal"),
            ("NR", "Nauru"), ("NU", "Niue"), ("NZ", "New Zealand"),
            ("OM", "Oman"), ("PA", "Panama"), ("PE", "Peru"),
            ("PF", "French Polynesia"), ("PG", "Papua New Guinea"), ("PH", "Philippines"),
            ("PK", "Pakistan"), ("PL", "Poland"), ("PM", "Saint Pierre and Miquelon"),
            ("PN", "Pitcairn Islands"), ("PR", "Puerto Rico"), ("PS", "Palestine"),
            ("PT", "Portugal"), ("PW", "Palau"), ("PY", "Paraguay"),
            ("QA", "Qatar"), ("RE", "Réunion"), ("RO", "Romania"),
            ("RS", "Serbia"), ("RU", "Russia"), ("RW", "Rwanda"),
            ("SA", "Saudi Arabia"), ("SB", "Solomon Islands"), ("SC", "Seychelles"),
            ("SD", "Sudan"), ("SE", "Sweden"), ("SG", "Singapore"),
            ("SH", "Saint Helena"), ("SI", "Slovenia"), ("SJ", "Svalbard and Jan Mayen"),
            ("SK", "Slovakia"), ("SL", "Sierra Leone"), ("SM", "San Marino"),
            ("SN", "Senegal"), ("SO", "Somalia"), ("SR", "Suriname"),
            ("SS", "South Sudan"), ("ST", "São Tomé and Príncipe"), ("SV", "El Salvador"),
            ("SX", "Sint Maarten"), ("SY", "Syria"), ("SZ", "Eswatini"),
            ("TC", "Turks and Caicos Islands"), ("TD", "Chad"), ("TF", "French Southern Territories"),
            ("TG", "Togo"), ("TH", "Thailand"), ("TJ", "Tajikistan"),
            ("TK", "Tokelau"), ("TL", "Timor-Leste"), ("TM", "Turkmenistan"),
            ("TN", "Tunisia"), ("TO", "Tonga"), ("TR", "Turkey"),
            ("TT", "Trinidad and Tobago"), ("TV", "Tuvalu"), ("TW", "Taiwan"),
            ("TZ", "Tanzania"), ("UA", "Ukraine"), ("UG", "Uganda"),
            ("UM", "United States Minor Outlying Islands"), ("US", "United States"),
            ("UY", "Uruguay"), ("UZ", "Uzbekistan"), ("VA", "Vatican City"),
            ("VC", "Saint Vincent and the Grenadines"), ("VE", "Venezuela"), ("VG", "British Virgin Islands"),
            ("VI", "United States Virgin Islands"), ("VN", "Vietnam"), ("VU", "Vanuatu"),
            ("WF", "Wallis and Futuna"), ("WS", "Samoa"), ("YE", "Yemen"),
            ("YT", "Mayotte"), ("ZA", "South Africa"), ("ZM", "Zambia"), ("ZW", "Zimbabwe")
        ]
        
        print(f"📝 Adding {len(domains)} domains...")
        
        # Add domains
        for domain in domains:
            session.run("""
                MERGE (d:Domain {name: $name})
                SET d.created_at = datetime()
            """, name=domain)
            print(f"  ✅ Added domain: {domain}")
        
        print(f"\n🌍 Adding {len(countries)} ISO countries...")
        
        # Add countries
        for code, name in countries:
            session.run("""
                MERGE (c:Country {code: $code, name: $name})
                SET c.created_at = datetime()
            """, code=code, name=name)
            print(f"  ✅ Added country: {name} ({code})")
        
        print(f"\n🎉 Successfully added {len(domains)} domains and {len(countries)} countries!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during bulk addition: {e}")
        return False
    
    finally:
        session.close()

if __name__ == "__main__":
    print("🚀 Bulk Add Domains and ISO Countries Script")
    print("This will add 20 domains and 249 ISO countries to Neo4j")
    print("Proceeding with bulk addition...")
    
    try:
        success = add_domains_and_countries()
        
        if success:
            print("\n🎉 Bulk addition completed successfully!")
        else:
            print("\n💥 Bulk addition failed. Please check the error messages above.")
            
    except KeyboardInterrupt:
        print("\n❌ Bulk addition cancelled by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
