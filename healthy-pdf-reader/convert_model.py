import os
import subprocess
import sys

def install(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

def convert():
    print("Checking dependencies...")
    try:
        import tensorflowjs
    except ImportError:
        print("tensorflowjs not found. Installing...")
        install("tensorflowjs")
        install("tensorflow")
        install("h5py")

    print("Starting conversion...")
    
    # Define paths
    input_model = "stress_ai/Stress-Detection-using-ML-and-Image-Processing-Techniques/model.h5"
    output_dir = "public/models/emotion_model"
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Construct command
    # We use subprocess to call the CLI directly which is often more robust
    cmd = [
        "tensorflowjs_converter",
        "--input_format=keras",
        input_model,
        output_dir
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    
    try:
        subprocess.check_call(cmd, shell=True)
        print("\n✅ Conversion Successful!")
        print(f"Files created in: {output_dir}")
        print("1. model.json")
        print("2. group1-shard1of1.bin (or similar)")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Conversion Failed: {e}")
        print("Please ensure you are running this in an environment with Python 3.6-3.9 if possible.")

if __name__ == "__main__":
    convert()
