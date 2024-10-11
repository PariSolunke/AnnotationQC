# AnnotationQC

This tool overlays image segmentation masks onto corresponding images to enable the labelling of segmentation quality.

# Installation Instructions

You need to have npm to setup the application. Clone this repo and in the application root run:
```
npm install
npm run build  
```

You can then launch the application by running
```
npm start
```

# Directory Structure Instructions:

You can choose the working directory by browsing to the appropriate folder. The expected structure of the directory is as follows:
* It should contain an "images" folder which has the original images.
* The segmentation masks should be in a folder titled "annotations" within the working directory.
* The expected image format for both images and masks is .png, and the application expects that the corresponding images and segmentation masks share the exact same name.
* The results are automatically saved/ updated in a csv file called annotation_quality.csv in the working directory.
