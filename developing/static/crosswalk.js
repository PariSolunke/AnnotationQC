document.addEventListener("DOMContentLoaded", function () {
    const crosswalkBtn = document.getElementById("crosswalkBtn");
    const canvas = document.getElementById("lassoCanvas");
    const ctx = canvas.getContext("2d");
    const image = document.getElementById("main-image");
    const annotationBox = document.getElementById("annotationBox");
    const annotationInput = document.getElementById("annotationInput");
    const confirmBtn = document.getElementById("confirmBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const annotationsContainer = document.getElementById("annotationsContainer");

    let isDrawing = false;
    let startX, startY, endX, endY;
    let annotations = [];
    let activeAnnotationIndex = null;

    function resetTool() {
        isDrawing = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.removeEventListener("mousedown", startDrawing);
        canvas.removeEventListener("mousemove", draw);
        canvas.removeEventListener("mouseup", stopDrawing);
    }

    function resizeCanvas() {
        canvas.width = image.clientWidth;
        canvas.height = image.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function startDrawing(e) {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        endX = startX;
        endY = startY;
    }

    function draw(e) {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        endX = e.clientX - rect.left;
        endY = e.clientY - rect.top;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawDashedLine(startX, startY, endX, endY);
    }

    function stopDrawing(e) {
        if (!isDrawing) return;
        isDrawing = false;

        const rect = canvas.getBoundingClientRect();
        endX = e.clientX - rect.left;
        endY = e.clientY - rect.top;

        drawDashedLine(startX, startY, endX, endY);

        // ✅ Convert canvas-relative position to screen position
        const annotationX = e.clientX;
        const annotationY = e.clientY;

        showAnnotationBox(annotationX, annotationY);
    }

    function drawDashedLine(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.setLineDash([10, 10]); // ✅ Dashed pattern
        ctx.strokeStyle = "black";
        ctx.lineWidth = 3;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]); // ✅ Reset back to normal
    }

    function showAnnotationBox(x, y) {
        annotationBox.style.display = "flex";
        annotationBox.style.left = `${x + 10}px`; // Slight offset for visibility
        annotationBox.style.top = `${y + 10}px`;
        annotationInput.value = "";
    }

    function hideAnnotationBox() {
        annotationBox.style.display = "none";
    }

    function addAnnotation() {
        const annotationText = annotationInput.value;
        if (annotationText.trim() !== "") {
            annotations.push({
                text: annotationText,
                startX: startX,
                startY: startY,
                endX: endX,
                endY: endY,
                type: "crosswalk",
            });
            updateAnnotationsList();
        }
        hideAnnotationBox();
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        activeAnnotationIndex = index;
        const annotation = annotations[index];
        if (annotation) {
            drawDashedLine(
                annotation.startX,
                annotation.startY,
                annotation.endX,
                annotation.endY
            );
        }
    }

    function cancelAnnotation() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hideAnnotationBox();
    }

    crosswalkBtn.addEventListener("click", () => {
        resetTool(); // ✅ Reset before enabling crosswalk tool
        resizeCanvas();
        canvas.style.pointerEvents = "auto";
        canvas.addEventListener("mousedown", startDrawing);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", stopDrawing);
    });

    confirmBtn.addEventListener("click", addAnnotation);
    cancelBtn.addEventListener("click", cancelAnnotation);
});
