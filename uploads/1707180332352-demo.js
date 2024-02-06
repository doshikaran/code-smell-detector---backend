/**
 * Simulates processing data from a database, including filtering,
 * mapping, and summarizing the information.
 * 
 * @param {Array<Object>} data - Array of objects representing database records.
 * @returns {Object} Summary of processed data including total count and average value.
 */
function processData(data) {
    try {
      // Log the start of data processing
      console.log("Starting to process data...");
  
      // Filter out invalid data
      const validData = data.filter(item => item.value !== null && item.isActive);
  
      // Transform the data (e.g., calculating new values)
      const transformedData = validData.map(item => {
        return {
          ...item,
          newValue: item.value * 2,
        };
      });
  
      // Summarize the data
      const summary = transformedData.reduce((acc, curr) => {
        acc.totalValue += curr.newValue;
        acc.count += 1;
        return acc;
      }, { totalValue: 0, count: 0 });
  
      // Calculate average value
      if (summary.count > 0) {
        summary.averageValue = summary.totalValue / summary.count;
      } else {
        summary.averageValue = 0;
      }
  
      // Log the completion of data processing
      console.log("Data processing complete.");
  
      // Return the summary
      return {
        totalCount: summary.count,
        totalValue: summary.totalValue,
        averageValue: summary.averageValue,
      };
    } catch (error) {
      // Log and rethrow any errors encountered during processing
      console.error("An error occurred during data processing:", error);
      throw error;
    }
  }
  