async function getBets(contractSlug) {
    let marketURL = await fetch(`https://manifold.markets/api/v0/slug/${contractSlug}`);
    let marketData = await marketURL.json();
    // First, check if we have cached data in local storage
    const cachedBets = localStorage.getItem(`bets_${contractSlug}`);
    if (cachedBets) {
        return [JSON.parse(cachedBets), marketData];
    }

    const allBets = [];
    let url = new URL('https://manifold.markets/api/v0/bets');
    url.searchParams.set('contractSlug', contractSlug);
    url.searchParams.set('limit', '1000'); // Max limit per request

    try {
        let hasMore = true;
        while (hasMore) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const bets = await response.json();

            if (bets.length > 0) {
                allBets.push(...bets);
                const lastBetId = bets[bets.length - 1].id;
                url.searchParams.set('before', lastBetId);
            } else {
                hasMore = false;
            }
        }
        // Cache the retrieved data in local storage
        try {
            localStorage.setItem(`bets_${contractSlug}`, JSON.stringify(allBets));
        } catch (error) {

        }

        return [allBets, marketData];
    } catch (error) {
        console.error('Error:', error);
    }
}
async function smoothData(data) {
    // Depending on the granularity, set the window size for the moving average
    let windowSize = 10 * 60 * 1000; // 10 minutes in milliseconds

    // Create a copy of the data to avoid mutating the original dataset
    let smoothedData = [...data];

    // Apply a moving average to smooth the data
    for (let i = 0; i < smoothedData.length; i++) {
        const startRange = smoothedData[i].x - windowSize / 2;
        const endRange = smoothedData[i].x + windowSize / 2;

        let sum = 0;
        let count = 0;
        for (let j = 0; j < data.length; j++) {
            if (data[j].x >= startRange && data[j].x <= endRange) {
                sum += data[j].y;
                count++;
            }
        }
        smoothedData[i].y = sum / count; // Assign the averaged value
    }

    return smoothedData;
}
async function visualizeData(marketInfo) {
    const [jsonData, marketMeta] = await marketInfo;
    // Parse the dates and sort the data by createdTime
    // ... rest of your code to process jsonData ...
    let sortedData = jsonData.map(bet => ({
        x: moment(bet.createdTime), // 'x' is the x-axis (time)
        y: bet.probBefore * 100 // Convert to percentage for the y-axis
    })).sort((a, b) => a.x - b.x);
    sortedData = await smoothData(sortedData);
    
    document.getElementById('slugInput').value = marketMeta.url;
    const ctx = document.getElementById('lineChart').getContext('2d');

    if (chartInstance !== null) {
        chartInstance.destroy();
    }
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Probability Before',
                data: sortedData,
                stepped: 'before', // This enables the stepped line
                fill: true,
                backgroundColor: '#d6f0e7',
                borderColor: '#12b981', // Example line color
                borderWidth: 1,
                pointRadius: 0, // Adjust as needed
                pointBackgroundColor: 'rgba(0, 0, 0, 0.8)', // Example point color
                // ... other dataset properties
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: marketMeta.question,
                    font: {
                        size: 18
                    },
                    padding: {
                        top: 10,
                        bottom: 30
                    }
                    // You can add more styling properties if needed
                },
                legend: {
                    display: false // This will hide the legend
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x', // Panning can be along 'x', 'y', or 'xy' axes
                    },
                    zoom: {
                        drag: {
                            enabled: true, // Enable drag-to-zoom
                            mode: 'x' // Zooming can be along 'x', 'y', or 'xy' axes
                        },
                        pinch: {
                            enabled: true, // Enable zooming with pinch gestures on touch devices
                        },
                        mode: 'x', // Zooming can be along 'x', 'y', or 'xy' axes
                        onZoomComplete: function({chart}) {
                            zoomUpdated = true;
                            updateState();
                        },
                    },
                },
                annotation: {
                    annotations: loadAnnotations() // Initialize as an empty array
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    custom: function(tooltipModel) {
                        // Tooltip Element
                        let tooltipEl = document.getElementById('chartjs-tooltip');
    
                        // Create element on first render
                        if (!tooltipEl) {
                            tooltipEl = document.createElement('div');
                            tooltipEl.id = 'chartjs-tooltip';
                            tooltipEl.innerHTML = '<table></table>';
                            document.body.appendChild(tooltipEl);
                        }
    
                        // Hide if no tooltip
                        if (tooltipModel.opacity === 0) {
                            tooltipEl.style.opacity = 0;
                            return;
                        }
    
                        // Set caret Position
                        tooltipEl.classList.remove('above', 'below', 'no-transform');
                        if (tooltipModel.yAlign) {
                            tooltipEl.classList.add(tooltipModel.yAlign);
                        } else {
                            tooltipEl.classList.add('no-transform');
                        }
    
                        function getBody(bodyItem) {
                            return bodyItem.lines;
                        }
    
                        // Set Text
                        if (tooltipModel.body) {
                            const titleLines = tooltipModel.title || [];
                            const bodyLines = tooltipModel.body.map(getBody);
    
                            let innerHtml = '<thead>';
    
                            titleLines.forEach(function(title) {
                                innerHtml += '<tr><th>' + title + '</th></tr>';
                            });
                            innerHtml += '</thead><tbody>';
    
                            bodyLines.forEach(function(body, i) {
                                const colors = tooltipModel.labelColors[i];
                                let style = 'background:' + colors.backgroundColor;
                                style += '; border-color:' + colors.borderColor;
                                style += '; border-width: 2px';
                                const span = '<span style="' + style + '"></span>';
                                innerHtml += '<tr><td>' + span + body + '</td></tr>';
                            });
                            innerHtml += '</tbody>';
    
                            let tableRoot = tooltipEl.querySelector('table');
                            tableRoot.innerHTML = innerHtml;
                        }
    
                        // `this` will be the overall tooltip
                        const position = this._chart.canvas.getBoundingClientRect();
    
                        // Display, position, and set styles for font
                        tooltipEl.style.opacity = 1;
                        tooltipEl.style.position = 'absolute';
                        tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
                        tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
                        tooltipEl.style.fontFamily = tooltipModel._bodyFontFamily;
                        tooltipEl.style.fontSize = tooltipModel.bodyFontSize + 'px';
                        tooltipEl.style.fontStyle = tooltipModel._bodyFontStyle;
                        tooltipEl.style.padding = tooltipModel.yPadding + 'px ' + tooltipModel.xPadding + 'px';
                        tooltipEl.style.pointerEvents = 'none';
                    }
                },
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM D'
                        }
                    },
                    // ... other x scale properties
                },
                y: {
                    min: 0,
                    max: 100,
                    // ... y scale configuration
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            // ... other chart options
        }
    });
    chartInstance.originalData = sortedData;
    updateAnnotationsList();
    loadZoom(chartInstance);
}
async function adjustChartData(chart, timeRange) {
    chart = await chart;
    let maxDate = new Date(Math.max(...chart.originalData.map(data => data.x)));

    let minDate = new Date(Math.min(...chart.originalData.map(data => data.x)));
    switch(timeRange) {
        case '1D':
            minDate = new Date(maxDate - 86400000); // last 24 hours
            break;
        case '1W':
            minDate = new Date(maxDate - 604800000); // last 7 days
            break;
        case '1M':
            minDate = new Date(maxDate - 2592000000); // last 30 days
            break;
        case 'all':
            break;
        default:
            throw new Error("invalid timerange");
    }
    chart.options.scales.x.min = minDate.getTime();
    chart.options.scales.x.max = maxDate.getTime();
    chart.update();
}
const url = window.location.href; // Get the current URL of the web page

/////////////////////////
//// Globals (start) ////
/////////////////////////

let urlState = parseUrlForState();
let slug;
console.log(urlState);
if ('market' in urlState) {
    slug = urlState['market'];
} else {
    slug = "will-oppenheimer-and-barbie-perform";
}
// let slug = "will-the-super-mario-bros-movie-202-c6dfd51afbc9";
let chartInstance = null;

/////////////////////////
//// Globals (end) //////
/////////////////////////

visualizeData(getBets(slug));

document.getElementById('slugForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from submitting the traditional way

    let slugInput = document.getElementById('slugInput').value;
    slug = extractSlug(slugInput);
    console.log(`Switching slug to ${slug}`);

    visualizeData(getBets(slug)); // Assuming this function updates the chart
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?market=${serializeSlug(slug)}` 
});

function extractSlug(urlOrSlug) {
    // Extracts the slug from a URL or returns the slug if it's already in slug format
    let urlPattern = /https?:\/\/[^\/]+\/[^\/]+\/([^\/#?]+)/i;
    let match = urlOrSlug.match(urlPattern);
    return match ? match[1] : urlOrSlug;
}

document.querySelectorAll('.time-range-selector input').forEach(input => {
    input.addEventListener('change', function() {
        adjustChartData(chartInstance, this.value);
        updateState();
    });
});


function encodeBase64ForURL(str) {
    // First, encode the string to UTF-8 and then to Base64
    const base64Str = btoa(unescape(encodeURIComponent(str)));
    
    // Make the Base64 string URL-safe by replacing '+' with '-', '/' with '_' and removing '='
    return base64Str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64ForURL(base64Str) {
    // Reverse the URL-safe encoding by replacing '-' with '+' and '_' with '/'
    let regularBase64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    
    // Pad the Base64 string with '=' to make it a multiple of 4
    while (regularBase64Str.length % 4) {
        regularBase64Str += '=';
    }

    // Decode from Base64 and then from UTF-8
    try {
        return decodeURIComponent(escape(atob(regularBase64Str)));
    } catch (e) {
        console.error("Error in decoding base64 string: ", e);
        return null;
    }
}

function serializeAnnotations(annotations) {
    // Serialize your annotations and market choice
    // Note: Ensure that the serialization format is URL-safe
    let annotationInfo = [];
    for (let idx=0; idx < annotations.length; idx+=2) {
        let lineAnnotation = annotations[idx];
        let textAnnotation = annotations[idx+1];
        annotationInfo.push([lineAnnotation.xMin, textAnnotation.yValue, textAnnotation.content, textAnnotation.source]);
    }
    console.log(annotationInfo);
    return encodeBase64ForURL(JSON.stringify(annotationInfo));
}
function deserializeAnnotations(annotationInfo) {
    let parsedAnnotations = JSON.parse(decodeBase64ForURL(annotationInfo));
    let annotations = [];
    for (let idx=0; idx < parsedAnnotations.length; idx++) {
        let [a, b] = getAnnotations(parsedAnnotations[idx][0], parsedAnnotations[idx][1], parsedAnnotations[idx][2], parsedAnnotations[idx][3]);
        annotations.push(a)
        annotations.push(b)
    }
    return annotations;
}

function serializeSlug(slug) {
    return encodeURIComponent(slug);
}
function deserializeSlug(slug) {
    return decodeURIComponent(slug);
}
function serializeZoom(chart) {
    const xAxis = chart.scales['x']; // Use your actual x-axis ID
    const yAxis = chart.scales['y']; // Use your actual y-axis ID

    // Create an object to store the zoom level
    const zoomLevel = {
        xMin: xAxis.min,
        xMax: xAxis.max,
        yMin: yAxis.min,
        yMax: yAxis.max
    };
    return encodeURIComponent(JSON.stringify(zoomLevel));
}
function deserializeZoom(zoomString) {
    return JSON.parse(decodeURIComponent(zoomString));
}


function parseUrlForState() {
    const urlSearchParams = new URLSearchParams(window.location.search);

    let urlState = {};
    if (urlSearchParams.has('annotations')) {
        urlState['annotations'] = urlSearchParams.get('annotations');
    }
    if (urlSearchParams.has('market')) {
        urlState['market'] = urlSearchParams.get('market');
    }
    if (urlSearchParams.has('zoom')) {
        urlState['zoom'] = urlSearchParams.get('zoom');
    }
    // Use these values to reconstruct your chart state
    return urlState;
}

let zoomUpdated = false;
function updateState() {
    const annotations = chartInstance.options.plugins.annotation.annotations;
    let serializedState = `market=${serializeSlug(slug)}`;
    if (annotations.length > 0) {
        serializedState += `&annotations=${serializeAnnotations(annotations)}`;
    }
    if (zoomUpdated) {
        serializedState += `&zoom=${serializeZoom(chartInstance)}`;
    }
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + serializedState;
    
    // Update URL without reloading the page
    window.history.pushState({path: newUrl}, '', newUrl);
    localStorage.setItem(`annotations_${slug}`, serializeAnnotations(annotations));
    localStorage.setItem(`zoom_${slug}`, serializeZoom(chartInstance));
}

function loadAnnotations() {
    let urlState = parseUrlForState();
    if ('annotations' in urlState) {
        return deserializeAnnotations(urlState['annotations']);
    }
    const savedAnnotations = localStorage.getItem(`annotations_${slug}`);
    if (savedAnnotations) {
        return deserializeAnnotations(savedAnnotations);

    }
    return [];
}


function getAnnotations(date, yValue, content, source) {
    let lineAnnotation = {
        type: 'line',
        xMin: date,
        xMax: date,
        borderColor: 'rgba(50, 50, 50, 0.9)',
        borderWidth: 2,
        label: {
            enabled: false // Disable the default label for the line
        },
        z: 0
    };
    let textAnnotation = {
        type: 'label',
        xValue: date, // Set the date for the line
        yValue: yValue,
        content: content,
        backgroundColor: 'rgba(50, 50, 50, 0.85)',
        position: "start",
        yPercent: 0,
        color: 'rgba(240, 240, 240, 1)',
        font: {
            size: 14,
            family: "sans-serif",
        },
        padding: 6,
        borderRadius: 3,
        z: 1,
        source: source,
        // More properties as needed
    };
    return [lineAnnotation, textAnnotation];
}

function addAnnotation(date) {
    let annotations = chartInstance.options.plugins.annotation.annotations.slice();
    let [lineAnnotation, textAnnotation] = getAnnotations(date, 100, 'Event ' + annotations.length/2, "");

    annotations.push(lineAnnotation);
    annotations.push(textAnnotation);
    chartInstance.options.plugins.annotation.annotations = annotations;

    chartInstance.update();
    updateAnnotationsList();
    updateState();
}

document.getElementById('lineChart').addEventListener('dblclick', function(event) {
    event.preventDefault();
    // Calculate the position on the x-axis from the click event
    const xValue = getXValueFromEvent(chartInstance, event);

    if (xValue) {
        addAnnotation(xValue);
    }
});
function getXValueFromEvent(chart, event) {
    const rect = chart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const xScale = chart.scales['x']; // Replace 'x' with your x-axis ID

    // Translate the pixel position to a chart value
    return xScale.getValueForPixel(x);
}

function formatDateTimeForInput(unixTimestamp) {
    // Create a new Date object from the Unix timestamp
    // Note: Unix timestamp should be in milliseconds for JavaScript Date object
    const date = new Date(unixTimestamp);
    
    // Convert to local date and time format expected by datetime-local
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}
function updateAnnotationsList() {
    const annotations = chartInstance.options.plugins.annotation.annotations;
    const annotationsList = document.getElementById('annotationsList');

    // Clear the current list
    annotationsList.innerHTML = '';

    // Add each annotation to the list
    
    for (let idx=0; idx<annotations.length; idx+=2) {
        let annotation = annotations[idx+1];
        const listItem = document.createElement('div');
        listItem.innerHTML = `
            <input type="text" class="annotationContent" onchange="updateAnnotationLabel(${idx+1}, this.value)">
            <input type="text" class="annotationSource" value="${annotation.source}" onchange="updateAnnotationSource(${idx+1}, this.value)">
            <input type="number" class="annotationYValue" value="${annotation.yValue}" onchange="updateAnnotationYPosition(${idx + 1}, this.value)">
            <input type="datetime-local" class="annotationDate" value="${formatDateTimeForInput(annotation.xValue)}" onchange="updateAnnotationXPosition(${idx}, this.value)">
            <button class="annotationDelete" onclick="removeAnnotation(${idx})">Delete</button>
        `;
        listItem.querySelector('.annotationContent').value = annotation.content;
        annotationsList.appendChild(listItem);
    };
}

function updateAnnotationLabel(index, newLabel) {
    const annotations = chartInstance.options.plugins.annotation.annotations;
    annotations[index].content = newLabel;
    chartInstance.update();
    updateState();
}
function updateAnnotationSource(index, source) {
    const annotations = chartInstance.options.plugins.annotation.annotations;
    annotations[index].source = source;
    chartInstance.update();
    updateState();
}

function updateAnnotationYPosition(index, newYPercentage) {
    newYPercentage = Number(newYPercentage); // Convert to a number

    // Retrieve the annotation
    const annotation = chartInstance.options.plugins.annotation.annotations[index];

    annotation.yValue = newYPercentage;

    // Refresh the chart
    chartInstance.update();
    updateState(); // Save the changes
}
function updateAnnotationXPosition(index, newTime) {
    let time = new Date(newTime);
    // Retrieve the annotation
    let annotations = chartInstance.options.plugins.annotation.annotations.slice();
    annotations[index].xMin = time.getTime();
    annotations[index].xMax = time.getTime();
    annotations[index + 1].xValue = time.getTime();
    chartInstance.options.plugins.annotation.annotations = annotations;
    // Refresh the chart
    chartInstance.update();
    updateState(); // Save the changes
}

function removeAnnotation(index) {
    const annotations = chartInstance.options.plugins.annotation.annotations.slice();
    annotations.splice(index, 1); // Remove the annotation
    annotations.splice(index, 1); // Remove the annotation
    chartInstance.options.plugins.annotation.annotations = annotations;
    updateAnnotationsList(); // Update the list
    chartInstance.update();
    updateState();
}


function loadZoom(chart) {
    let urlState = parseUrlForState();
    let zoomLevel;
    if ('zoom' in urlState) {
        console.log("load zoom from url")
        zoomLevel = deserializeZoom(urlState['zoom']);
    } else {
        console.log("load zoom from storage")
        zoomLevel = deserializeZoom(localStorage.getItem(`zoom_${slug}`));
    }
    // Retrieve the cached zoom level from localStorage

    if (zoomLevel) {
        zoomUpdated = true;
        const xAxis = chart.options.scales['x']; // Use your actual x-axis ID
        const yAxis = chart.options.scales['y']; // Use your actual y-axis ID

        // Apply the cached zoom level to the chart axes
        xAxis.min = zoomLevel.xMin;
        xAxis.max = zoomLevel.xMax;
        yAxis.min = zoomLevel.yMin;
        yAxis.max = zoomLevel.yMax;

        // Update the chart to reflect the changes
        chart.update();
    }
}
