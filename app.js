async function getBets(contractSlug) {
    // First, check if we have cached data in local storage
    const cachedBets = localStorage.getItem(`bets_${contractSlug}`);
    if (cachedBets) {
        return JSON.parse(cachedBets);
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
        localStorage.setItem(`bets_${contractSlug}`, JSON.stringify(allBets));

        return allBets;
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
async function visualizeData(allBets) {
    const jsonData = await allBets;
    // Parse the dates and sort the data by createdTime
    // ... rest of your code to process jsonData ...
    let sortedData = jsonData.map(bet => ({
        x: moment(bet.createdTime), // 'x' is the x-axis (time)
        y: bet.probBefore * 100 // Convert to percentage for the y-axis
    })).sort((a, b) => a.x - b.x);
    sortedData = await smoothData(sortedData);
    
    // debugger;
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
                        mode: 'x' // Zooming can be along 'x', 'y', or 'xy' axes
                    }
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
                }
            },
            // ... other chart options
        }
    });
    chartInstance.originalData = sortedData;
    updateAnnotationsList();
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

let slug = "will-sam-altman-be-the-ceo-of-opena";
// let slug = "will-the-super-mario-bros-movie-202-c6dfd51afbc9";
let chartInstance = null;

/////////////////////////
//// Globals (end) //////
/////////////////////////

console.log(slug);
const allBets = getBets(slug);
visualizeData(getBets(slug));

document.getElementById('slugForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from submitting the traditional way

    let slugInput = document.getElementById('slugInput').value;
    slug = extractSlug(slugInput);
    console.log(`Switching slug to ${slug}`);

    let allBets = getBets(slug);
    visualizeData(allBets); // Assuming this function updates the chart
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
    });
});

function saveAnnotations() {
    const annotations = chartInstance.options.plugins.annotation.annotations;
    localStorage.setItem(`annotations_${slug}`, JSON.stringify(annotations));
}

function loadAnnotations() {
    const savedAnnotations = localStorage.getItem(`annotations_${slug}`);
    return savedAnnotations ? JSON.parse(savedAnnotations) : [];
}

function addAnnotation(date) {
    let annotations = chartInstance.options.plugins.annotation.annotations.slice();
    let annotation = {
        type: 'line',
        xMin: date, // Set the date for the line
        xMax: date, // Same as xMin for a vertical line
        borderColor: 'rgba(64, 64, 64, 0.8)',
        borderWidth: 2,
        label: {
            content: 'Event ' + annotations.length,
            enabled: true,
            position: "start", // Positions label at the start (bottom for a horizontal line, left for a vertical line)
            yAdjust: 0, // Adjusts the y position of the label
            backgroundColor: 'rgba(0, 0, 0, 0.85)', // Light grey, semi-transparent background
            font: {
                size: 12, // Example font size
                style: 'normal', // Normal, italic, or oblique
                family: "sans-serif", // Font family
                color: 'rgba(0, 0, 0)' // Dark grey font color for text
            },
            padding: 4, // Adds padding inside the label box
            borderRadius: 4, // Optional: if you want rounded corners
        }
    };

    annotations.push(annotation);
    chartInstance.options.plugins.annotation.annotations = annotations;

    chartInstance.update();
    updateAnnotationsList();
    saveAnnotations();
}
document.getElementById('lineChart').addEventListener('click', function(event) {
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

function updateAnnotationsList() {
    const annotations = chartInstance.options.plugins.annotation.annotations;
    const annotationsList = document.getElementById('annotationsList');

    // Clear the current list
    annotationsList.innerHTML = '';

    // Add each annotation to the list
    annotations.forEach((annotation, index) => {
        const listItem = document.createElement('div');
        listItem.innerHTML = `
            <input type="text" value="${annotation.label.content}" onchange="updateAnnotationLabel(${index}, this.value)">
            <input type="number" value="${yAdjustToPercentage(annotation.label.yAdjust)}" onchange="updateAnnotationYPosition(${index}, this.value)">
            <button onclick="removeAnnotation(${index})">Delete</button>
        `;
        annotationsList.appendChild(listItem);
    });
}

function updateAnnotationLabel(index, newLabel) {
    const annotations = chartInstance.options.plugins.annotation.annotations;
    annotations[index].label.content = newLabel;
    chartInstance.update();
    saveAnnotations();
}

function yAdjustToPercentage(yAdjust) {
    let yScale = chartInstance.scales['y'];
    const pixelPerUnit = yScale.height / 100;
    let out = Math.round(100 - 100*(yAdjust/yScale.height));
    return out;
}
function percentageToYAdjust(percentage) {
    let yScale = chartInstance.scales['y'];
    let out = (100 - percentage)/100 * yScale.height;
    console.log(out);
    return out;

}
function updateAnnotationYPosition(index, newYPercentage) {
    newYPercentage = Number(newYPercentage); // Convert to a number

    // Retrieve the annotation
    const annotation = chartInstance.options.plugins.annotation.annotations[index];

    if (annotation.label) {
        // Adjust relative to the bottom of the chart
        annotation.label.yAdjust = percentageToYAdjust(newYPercentage);
    }

    // Refresh the chart
    chartInstance.update();
    saveAnnotations(); // Save the changes
}

function removeAnnotation(index) {
    const annotations = chartInstance.options.plugins.annotation.annotations.slice();
    annotations.splice(index, 1); // Remove the annotation
    chartInstance.options.plugins.annotation.annotations = annotations;
    updateAnnotationsList(); // Update the list
    chartInstance.update();
    saveAnnotations();
}