# COPY AND PASTE THIS ENTIRE BLOCK INTO A GOOGLE COLAB CELL

import os

# 0. CHECK IF FILE EXISTS
if not os.path.exists("model.h5"):
    print("❌ STOP! ERROR!")
    print("You did NOT upload the 'model.h5' file yet.")
    print("1. Click the Folder icon on the left.")
    print("2. Upload 'model.h5' from your computer.")
    print("3. Then run this code again.")
else:
    print("✅ model.h5 found! Starting conversion...")

    # 1. Install TensorFlow.js
    !pip install tensorflowjs

    # 2. Convert Model
    os.makedirs("emotion_model", exist_ok=True)
    
    # Run conversion
    print("Converting model...")
    !tensorflowjs_converter --input_format=keras model.h5 emotion_model

    # 3. Verify Conversion worked
    if os.path.exists("emotion_model/model.json"):
        print("✅ Conversion Successful!")
        # 4. Zip and Download
        !zip -r emotion_model.zip emotion_model
        
        try:
            from google.colab import files
            files.download('emotion_model.zip')
            print("Downloading zip file...")
        except ImportError:
            print("Auto-download failed. Please download 'emotion_model.zip' from the left sidebar.")
    else:
        print("❌ Conversion FAILED.")
        print("Please check the error logs above.")
