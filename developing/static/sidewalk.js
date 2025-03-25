document.addEventListener("DOMContentLoaded", function () {
    const sidewalkBtn = document.getElementById("sidewalkBtn");
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
    let activeAnnotationIndex = null;

    function resetTool() {
        isDrawing = false;
        points = [];
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
        points = [];
        const rect = canvas.getBoundingClientRect();
        points.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    function draw(e) {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        points.push({ x, y });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawSmoothedPath(points);
    }

    function stopDrawing(e) {
        if (!isDrawing) return;
        isDrawing = false;

        if (points.length > 2) {
            showAnnotationBox(e.clientX, e.clientY);
        }
    }

    function drawSmoothedPath(rawPoints) {
        const smoothedPoints = chaikinSmooth(rawPoints, 3); // Apply smoothing 3 times

        if (smoothedPoints.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(smoothedPoints[0].x, smoothedPoints[0].y);
        for (let i = 1; i < smoothedPoints.length; i++) {
            ctx.lineTo(smoothedPoints[i].x, smoothedPoints[i].y);
        }
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    function showAnnotationBox(x, y) {
        annotationBox.style.display = "flex";
        annotationBox.style.left = `${x + 10}px`;
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
                region: [...points],
                type: "sidewalk",
            });
            updateAnnotationsList();
        }
        hideAnnotationBox();
        points = [];
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
            drawSmoothedPath(annotation.region);
        }
    }

    function chaikinSmooth(points, iterations) {
        let smoothed = points;
        for (let i = 0; i < iterations; i++) {
            let newPoints = [];
            newPoints.push(smoothed[0]); // Keep first point

            for (let j = 0; j < smoothed.length - 1; j++) {
                const p1 = smoothed[j];
                const p2 = smoothed[j + 1];

                const q = {
                    x: 0.75 * p1.x + 0.25 * p2.x,
                    y: 0.75 * p1.y + 0.25 * p2.y,
                };
                const r = {
                    x: 0.25 * p1.x + 0.75 * p2.x,
                    y: 0.25 * p1.y + 0.75 * p2.y,
                };

                newPoints.push(q);
                newPoints.push(r);
            }

            newPoints.push(smoothed[smoothed.length - 1]); // Keep last point
            smoothed = newPoints;
        }
        return smoothed;
    }

    function cancelAnnotation() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hideAnnotationBox();
        points = [];
    }

    sidewalkBtn.addEventListener("click", () => {
        resetTool();
        resizeCanvas();
        canvas.style.pointerEvents = "auto";
        canvas.addEventListener("mousedown", startDrawing);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", stopDrawing);
    });

    confirmBtn.addEventListener("click", addAnnotation);
    cancelBtn.addEventListener("click", cancelAnnotation);
});
