document.addEventListener("DOMContentLoaded", function () {
    const selectBtn = document.getElementById("selectBtn");
    const canvas = document.getElementById("lassoCanvas");
    const ctx = canvas.getContext("2d");
    const image = document.getElementById("main-image");
    const annotationBox = document.getElementById("annotationBox");
    const annotationInput = document.getElementById("annotationInput");
    const confirmBtn = document.getElementById("confirmBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const annotationsContainer = document.getElementById("annotationsContainer");

    let isDrawing = false;
    let points = [];
    let annotations = [];
    let activeAnnotationIndex = null; // Track which annotation is active

    function resizeCanvas() {
        canvas.width = image.clientWidth;
        canvas.height = image.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function startDrawing(e) {
        isDrawing = true;
        points = [];  // ✅ Reset points when starting a new drawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function draw(e) {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        points.push({ x, y });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCurrentSelection(); // ✅ Only draw the new region
    }

    function stopDrawing(e) {
        isDrawing = false;
        if (points.length > 2) {
            ctx.lineTo(points[0].x, points[0].y);
            ctx.stroke();
            ctx.closePath();
            showAnnotationBox(e.clientX, e.clientY);
        }
    }

    function drawCurrentSelection() {
        if (points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function fillSelection(region, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(region[0].x, region[0].y);
        for (let i = 1; i < region.length; i++) {
            ctx.lineTo(region[i].x, region[i].y);
        }
        ctx.closePath();
        ctx.fill();
    }

    function showAnnotationBox(x, y) {
        annotationBox.style.display = "flex";
        annotationBox.style.left = `${x}px`;
        annotationBox.style.top = `${y}px`;
        annotationInput.value = "";
    }

    function hideAnnotationBox() {
        annotationBox.style.display = "none";
    }

    function addAnnotation() {
        const annotationText = annotationInput.value;
        if (annotationText.trim() !== "" && points.length > 2) {
            annotations.push({ text: annotationText, region: [...points] });
            updateAnnotationsList();
        }
        hideAnnotationBox();
        points = []; // ✅ Reset points after adding an annotation
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function updateAnnotationsList() {
        annotationsContainer.innerHTML = "";
        annotations.forEach((annotation, index) => {
            const li = document.createElement("li");
            li.textContent = `${index + 1}. ${annotation.text}`;
            li.dataset.index = index;
            li.addEventListener("click", () => highlightAnnotation(index));
            annotationsContainer.appendChild(li);
        });
    }

    function highlightAnnotation(index) {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // ✅ Hide all regions
        activeAnnotationIndex = index; // ✅ Track active annotation
        const annotation = annotations[index];
        if (annotation) {
            fillSelection(annotation.region, "rgba(135, 206, 250, 0.5)"); // ✅ Show only active region in sky blue
        }
    }

    function cancelAnnotation() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hideAnnotationBox();
        points = []; // ✅ Reset points on cancel
    }

    selectBtn.addEventListener("click", () => {
        resizeCanvas();
        canvas.style.pointerEvents = "auto";
        canvas.addEventListener("mousedown", startDrawing);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", stopDrawing);
    });

    confirmBtn.addEventListener("click", addAnnotation);
    cancelBtn.addEventListener("click", cancelAnnotation);
});
