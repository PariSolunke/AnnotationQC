# AnnotationQC

This tool overlays image segmentation masks onto corresponding images to enable the labelling of segmentation quality.

# Installation Instructions

You need to have node and npm installed to run and setup the application. The instructions for the same should be available 

Once you have npm set up, Clone this repo, navigate to the application root in the terminal and run:

```
npm install
npm run build  
```

You can then launch the application by running the following command in the root directory of the application (the directory where the build directory was created)
```
npx serve -s build
```
Once the server is running, navigate to the link displayed in the terminal window to run the application. Select the directory which contains images and masks (directory structure instructions are below)

# Directory Structure Instructions:

You can choose the working directory by browsing to the appropriate folder. The expected structure of the directory is as follows:
* It should contain an "images" folder which has the original images.
* The segmentation masks should be in a folder titled "annotations" within the working directory.
* The expected image format for both images and masks is .png, and the application expects that the corresponding images and segmentation masks share the exact same name.
