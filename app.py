from flask import Flask, jsonify, render_template, request
import urllib.request
import xml.etree.ElementTree as ET
import re
import datetime

app = Flask(__name__)

# Simple in-memory cache to be nice to Google's feed servers and ensure instant loads
cache = {
    "data": None,
    "last_fetched": None
}
CACHE_DURATION_SECS = 300  # 5 minutes

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    try:
        # Construct request with user agent to avoid any potential blockages
        req = urllib.request.Request(
            FEED_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        entries = root.findall('atom:entry', ns)
        
        parsed_items = []
        
        for entry in entries:
            title_elem = entry.find('atom:title', ns)
            updated_elem = entry.find('atom:updated', ns)
            id_elem = entry.find('atom:id', ns)
            content_elem = entry.find('atom:content', ns)
            
            title = title_elem.text if title_elem is not None else "Unknown Date"
            updated = updated_elem.text if updated_elem is not None else ""
            entry_id = id_elem.text if id_elem is not None else ""
            content_html = content_elem.text if content_elem is not None else ""
            
            if not content_html:
                continue
                
            # Split HTML by <h3> tags using regex
            parts = re.split(r'(<h3>.*?</h3>)', content_html)
            
            # The split creates a list like [ignored_stuff, '<h3>Category</h3>', 'content for category', ...]
            # Iterate through the elements starting at index 1 in steps of 2
            for i in range(1, len(parts), 2):
                h3_tag = parts[i]
                category = re.sub('<[^<]+?>', '', h3_tag).strip()
                
                content = parts[i+1] if i+1 < len(parts) else ""
                content = content.strip()
                
                if not content:
                    continue
                
                # Create a clean unique ID for the item using a string hash
                item_hash = hash(f"{entry_id}_{category}_{content[:100]}")
                item_id = f"bq-{abs(item_hash)}"
                
                parsed_items.append({
                    "id": item_id,
                    "date": title,
                    "updated": updated,
                    "category": category,
                    "content": content
                })
                
        return parsed_items, None
    except Exception as e:
        return None, str(e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    now = datetime.datetime.now()
    
    # Check cache first if force is not requested
    if not force_refresh and cache["data"] is not None and cache["last_fetched"] is not None:
        elapsed = (now - cache["last_fetched"]).total_seconds()
        if elapsed < CACHE_DURATION_SECS:
            return jsonify({
                "status": "success",
                "source": "cache",
                "last_fetched": cache["last_fetched"].isoformat(),
                "data": cache["data"]
            })
            
    # Fetch fresh data
    data, error = fetch_and_parse_feed()
    if error:
        # If fetch fails but we have stale cache, return the stale cache with a warning
        if cache["data"] is not None:
            return jsonify({
                "status": "warning",
                "message": f"Failed to refresh feed: {error}. Displaying previous version.",
                "source": "stale_cache",
                "last_fetched": cache["last_fetched"].isoformat(),
                "data": cache["data"]
            })
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch feed: {error}"
        }), 500
        
    # Update cache on success
    cache["data"] = data
    cache["last_fetched"] = now
    
    return jsonify({
        "status": "success",
        "source": "network",
        "last_fetched": now.isoformat(),
        "data": data
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
