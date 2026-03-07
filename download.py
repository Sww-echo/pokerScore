import urllib.request
import json
import os

API_KEY = "AQ.Ab8RN6KIlmuWbWS3iee2cio86Srgd9DCeGVAEqYNPMCtqqO9eQ"
PROJECT_ID = "3044017134653589031"
SCREENS = [
    ("1_首页_简约淡色版", "825feba67cca4d318f908c72e210eda8"),
    ("2_房间页_简约淡色版", "82e6e984c5074822902009c23a26334d"),
    ("3_转分弹窗_简约淡色版", "b82787aa6d9644dbaae9a87db7b96834"),
    ("4_房间设置_简约淡色版", "3e7d2a446f164b3da4cfb67e9a804de5"),
    ("5_结算页_简约淡色版", "d1fc9255282c4f49a7815a3c7ace01e1"),
    ("6_对局记录_简约淡色版", "e9c868afe6c2456c8efdbbd6209e0b63")
]

BASE_URL = "https://stitch.googleapis.com/v1/projects/"

os.makedirs("screens", exist_ok=True)

for name, screen_id in SCREENS:
    print(f"Fetching metadata for {name} ({screen_id})...")
    url = f"{BASE_URL}{PROJECT_ID}/screens/{screen_id}"
    req = urllib.request.Request(url, headers={"X-Goog-Api-Key": API_KEY})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            
            # download image
            if 'screenshot' in data and 'downloadUrl' in data['screenshot']:
                img_url = data['screenshot']['downloadUrl']
                print(f"Downloading image for {name}...")
                img_req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(img_req) as img_resp, open(f"screens/{name}.png", 'wb') as f:
                    f.write(img_resp.read())
            
            # download code
            if 'htmlCode' in data and 'downloadUrl' in data['htmlCode']:
                code_url = data['htmlCode']['downloadUrl']
                print(f"Downloading code for {name}...")
                code_req = urllib.request.Request(code_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(code_req) as code_resp, open(f"screens/{name}.html", 'wb') as f:
                    f.write(code_resp.read())
    except Exception as e:
        print(f"Failed to fetch {name}: {e}")

print("Done.")
