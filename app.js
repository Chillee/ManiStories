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
        y: bet.probAfter * 100 // Convert to percentage for the y-axis
    })).sort((a, b) => a.x - b.x);
    sortedData = await smoothData(sortedData);
    
    // debugger;
    const ctx = document.getElementById('lineChart').getContext('2d');
    // #d6f0e7
    const lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Probability After',
                data: sortedData,
                stepped: 'after', // This enables the stepped line
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
                    annotations: {
                        myVerticalLine: {
                            type: 'line',
                            xMin: '2023-11-19', // Set the date for the line
                            xMax: '2023-11-19', // Same as xMin for a vertical line
                            borderColor: 'rgb(99, 99, 132)',
                            borderWidth: 2,
                            label: {
                                content: 'Great things happened',
                                enabled: true,
                                position: 'start'
                            }
                        }
                        // ... Add more annotations as needed
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
    lineChart.originalData = sortedData;
    return lineChart;
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

// Parse the URL to extract the slug
const urlSegments = new URL(url).pathname.split('/'); // Split the URL by '/'
let slug;
if (urlSegments.length > 5 && false) {
    slug = urlSegments[urlSegments.length - 1]; // Get the last segment of the URL
} else {
    // let slug = 
    // let slug = "will-taylor-swifts-eras-tour-gross";
    slug = "will-sam-altman-be-the-ceo-of-opena";
}

console.log(slug);
const allBets = getBets(slug);
let chart = visualizeData(getBets(slug));
document.querySelectorAll('.time-range-selector input').forEach(input => {
    input.addEventListener('change', function() {
        adjustChartData(chart, this.value);
    });
});