"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { parse } from "date-fns";
import { parseCsvToInitiatives } from "../csv";
import { getToday } from "../dates";
import { Button } from "../components/button";
import { Initiative } from "../types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ScopeDataPoint = {
  date: Date;
  totalScope: number;
  workDone: number;
  fileName: string;
  initiativeCount: number;
  initiatives: Initiative[]; // Store raw initiatives for filtering
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
        <p className="font-bold text-gray-800">
          {data.date instanceof Date ? data.date.toLocaleDateString() : data.date}
        </p>
        <p className="text-sm text-blue-500">
          Total Scope: {data.totalScope.toFixed(1)} days
        </p>
        <p className="text-sm text-green-500">
          Work Done: {data.workDone.toFixed(1)} days
        </p>
        <p className="text-sm text-purple-500">
          Initiatives: {data.initiativeCount}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          File: {data.fileName}
        </p>
      </div>
    );
  }
  return null;
};

export default function ScopeTrackingPage() {
  const [scopeData, setScopeData] = useState<ScopeDataPoint[]>([]);
  const [filterDate, setFilterDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractDateFromFileName = (fileName: string): Date | null => {
    // Pattern: "Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv"
    const datePattern = /(\w{3}\s+\d{1,2},\s+\d{4})/;
    const match = fileName.match(datePattern);
    
    if (match) {
      try {
        // Parse the date string (e.g., "Jul 10, 2025")
        const date = parse(match[1], "MMM d, yyyy", new Date());
        return date;
      } catch (error) {
        console.error("Error parsing date from filename:", error);
        return null;
      }
    }
    
    return null;
  };

  const processFile = useCallback(async (file: File): Promise<ScopeDataPoint | null> => {
    const date = extractDateFromFileName(file.name);
    if (!date) {
      throw new Error(`Could not extract date from filename: ${file.name}`);
    }

    const text = await file.text();
    const result = parseCsvToInitiatives(getToday(), text);
    
    if (result.outcome === "error") {
      throw new Error(result.error);
    }

    const totalScope = result.initiatives.reduce(
      (sum, initiative) => sum + initiative.totalWork,
      0
    );

    const workDone = result.initiatives.reduce(
      (sum, initiative) => sum + initiative.doneWork,
      0
    );

    return {
      date,
      totalScope,
      workDone,
      fileName: file.name,
      initiativeCount: result.initiatives.length,
      initiatives: result.initiatives,
    };
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsLoading(true);
      setError(null);

      try {
        const newDataPoints: ScopeDataPoint[] = [];

        for (const file of acceptedFiles) {
          try {
            const dataPoint = await processFile(file);
            if (dataPoint) {
              newDataPoints.push(dataPoint);
            }
          } catch (fileError) {
            console.error(`Error processing file ${file.name}:`, fileError);
            setError(`Error processing ${file.name}: ${fileError}`);
          }
        }

        // Sort by date and merge with existing data
        const allData = [...scopeData, ...newDataPoints].sort(
          (a, b) => a.date.getTime() - b.date.getTime()
        );

        setScopeData(allData);
      } catch (error) {
        setError(`Error processing files: ${error}`);
      } finally {
        setIsLoading(false);
      }
    },
    [scopeData, processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    multiple: true,
  });

  const clearData = () => {
    setScopeData([]);
    setError(null);
    setFilterDate("");
  };

  // Filter data based on selected date
  const getFilteredData = () => {
    if (!filterDate) {
      return scopeData;
    }

    const filterDateObj = new Date(filterDate);
    filterDateObj.setHours(23, 59, 59, 999); // End of day

    return scopeData.map(dataPoint => {
      const filteredInitiatives = dataPoint.initiatives.filter((initiative: Initiative) => {
        const targetDate = new Date(initiative.targetDate);
        return targetDate <= filterDateObj;
      });

      const filteredTotalScope = filteredInitiatives.reduce(
        (sum: number, initiative: Initiative) => sum + initiative.totalWork,
        0
      );

      const filteredWorkDone = filteredInitiatives.reduce(
        (sum: number, initiative: Initiative) => sum + initiative.doneWork,
        0
      );

      return {
        ...dataPoint,
        totalScope: filteredTotalScope,
        workDone: filteredWorkDone,
        initiativeCount: filteredInitiatives.length,
      };
    });
  };

  const calculateProjectedFinishDate = () => {
    const filteredData = getFilteredData();
    if (filteredData.length < 2) {
      return null;
    }

    // Sort by date to ensure we have earliest and latest
    const sortedData = [...filteredData].sort((a, b) => a.date.getTime() - b.date.getTime());
    const earliest = sortedData[0];
    const latest = sortedData[sortedData.length - 1];

    // Calculate days between earliest and latest timestamps
    const daysBetween = Math.max(1, (latest.date.getTime() - earliest.date.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate work done per day
    const workDoneDifference = latest.workDone - earliest.workDone;
    const workRatePerDay = workDoneDifference / daysBetween;

    // If no work is being done, return null
    if (workRatePerDay <= 0) {
      return null;
    }

    // Calculate remaining work
    const remainingWork = latest.totalScope - latest.workDone;

    // Calculate days remaining
    const daysRemaining = remainingWork / workRatePerDay;

    // Calculate projected finish date
    const projectedFinishDate = new Date(latest.date.getTime() + (daysRemaining * 24 * 60 * 60 * 1000));

    return {
      projectedFinishDate,
      workRatePerDay,
      remainingWork,
      daysRemaining,
      earliestDate: earliest.date,
      latestDate: latest.date,
    };
  };

  const calculateScopeCreep = () => {
    const filteredData = getFilteredData();
    if (filteredData.length < 2) {
      return null;
    }

    // Sort by date to ensure we have earliest and latest
    const sortedData = [...filteredData].sort((a, b) => a.date.getTime() - b.date.getTime());
    const latest = sortedData[sortedData.length - 1];
    
    // Calculate 14 days ago from the latest date
    const fourteenDaysAgo = new Date(latest.date.getTime() - (14 * 24 * 60 * 60 * 1000));
    
    // Find the data point closest to 14 days ago (or the earliest available if less than 14 days)
    let comparisonPoint = sortedData[0]; // Default to earliest point
    
    for (let i = sortedData.length - 2; i >= 0; i--) {
      const point = sortedData[i];
      if (point.date <= fourteenDaysAgo) {
        comparisonPoint = point;
        break;
      }
    }
    
    // Calculate scope change
    const scopeChange = latest.totalScope - comparisonPoint.totalScope;
    const daysBetween = Math.max(1, (latest.date.getTime() - comparisonPoint.date.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      scopeChange,
      scopeChangePerDay: scopeChange / daysBetween,
      comparisonDate: comparisonPoint.date,
      latestDate: latest.date,
      daysBetween: Math.round(daysBetween),
    };
  };

  const chartData = getFilteredData().map((point) => ({
    ...point,
    date: point.date.toLocaleDateString(),
  }));

  const projection = calculateProjectedFinishDate();
  const scopeCreep = calculateScopeCreep();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Scope Tracking Over Time
              </h1>
              <p className="mt-2 text-gray-600">
                Upload multiple CSV files to track how project scope changes over time
              </p>
            </div>
            <Button variant="button" onClick={() => window.history.back()}>
              Back to Main
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {isDragActive
                    ? "Drop the files here..."
                    : "Upload CSV files"}
                </p>
                <p className="text-sm text-gray-500">
                  Drag and drop multiple CSV files, or click to select files
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Expected filename format: &quot;Envest Delivery Schedule - Product Planning Jul 10, 2025 10_06 AM.csv&quot;
                </p>
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center px-4 py-2 text-sm text-blue-700 bg-blue-100 rounded-md">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing files...
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {scopeData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Scope Changes Over Time
              </h2>
              <Button variant="button" onClick={clearData}>
                Clear Data
              </Button>
            </div>

            {/* Date Filter */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">
                    Filter by Target Completion Date
                  </h3>
                  <p className="text-xs text-gray-600">
                    {filterDate 
                      ? `Showing initiatives due on or before ${new Date(filterDate).toLocaleDateString()}`
                      : "Showing all initiatives (no filter applied)"
                    }
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Select date"
                  />
                  {filterDate && (
                    <Button 
                      variant="button" 
                      onClick={() => setFilterDate("")}
                      className="text-sm"
                    >
                      Clear Filter
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {projection && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Projection Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700 font-medium">Work Rate</p>
                    <p className="text-blue-900">{projection.workRatePerDay.toFixed(2)} days/day</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-medium">Remaining Work</p>
                    <p className="text-blue-900">{projection.remainingWork.toFixed(1)} days</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-medium">Est days to completion</p>
                    <p className="text-blue-900">{projection.daysRemaining.toFixed(1)} days</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-medium">Projected Finish</p>
                    <p className="text-blue-900 font-semibold">
                      {projection.projectedFinishDate.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-blue-600">
                  Based on data from {projection.earliestDate.toLocaleDateString()} to {projection.latestDate.toLocaleDateString()}
                </div>
              </div>
            )}

            {scopeCreep && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="text-lg font-semibold text-orange-900 mb-2">
                  Scope Change - Last 14 Days
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-orange-700 font-medium">Total Scope Change</p>
                    <p className={`font-semibold ${scopeCreep.scopeChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {scopeCreep.scopeChange >= 0 ? '+' : ''}{scopeCreep.scopeChange.toFixed(1)} days
                    </p>
                  </div>
                  <div>
                    <p className="text-orange-700 font-medium">Scope Change Rate</p>
                    <p className={`font-semibold ${scopeCreep.scopeChangePerDay >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {scopeCreep.scopeChangePerDay >= 0 ? '+' : ''}{scopeCreep.scopeChangePerDay.toFixed(2)} days/day
                    </p>
                  </div>
                  <div>
                    <p className="text-orange-700 font-medium">Time Period</p>
                    <p className="text-orange-900">{scopeCreep.daysBetween} days</p>
                  </div>
                  <div>
                    <p className="text-orange-700 font-medium">Comparison Date</p>
                    <p className="text-orange-900">{scopeCreep.comparisonDate.toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-orange-600">
                  Comparing {scopeCreep.comparisonDate.toLocaleDateString()} to {scopeCreep.latestDate.toLocaleDateString()}
                </div>
              </div>
            )}

            {/* Projected finish date with scope creep */}
            {projection && scopeCreep && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Projected Finish Date with Scope Creep
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-red-700 font-medium">Work Rate</p>
                    <p className="text-red-900">{projection.workRatePerDay.toFixed(2)} days/day</p>
                  </div>
                  <div>
                    <p className="text-red-700 font-medium">Scope Change Rate</p>
                    <p className={`font-semibold ${scopeCreep.scopeChangePerDay >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {scopeCreep.scopeChangePerDay >= 0 ? '+' : ''}{scopeCreep.scopeChangePerDay.toFixed(2)} days/day
                    </p>
                  </div>
                  <div>
                    <p className="text-red-700 font-medium">Effective Work Rate with Scope Creep</p>
                    <p className={`font-semibold ${(projection.workRatePerDay - scopeCreep.scopeChangePerDay) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {(projection.workRatePerDay - scopeCreep.scopeChangePerDay).toFixed(2)} days/day
                    </p>
                  </div>
                  <div>
                    <p className="text-red-700 font-medium">Remaining Work</p>
                    <p className="text-red-900">{projection.remainingWork.toFixed(1)} days</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white border border-red-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-red-700 font-medium">Projected Finish Date with Scope Creep:</span>
                    <span className="text-red-900 font-bold text-lg">
                      {(() => {
                        const effectiveWorkRate = projection.workRatePerDay - scopeCreep.scopeChangePerDay;
                        const daysToCompletionWithCreep = projection.remainingWork / effectiveWorkRate;
                        const projectedDateWithCreep = new Date(new Date().getTime() + (daysToCompletionWithCreep * 24 * 60 * 60 * 1000));
                        return projectedDateWithCreep.toLocaleDateString();
                      })()}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-red-600">
                  Based on effective work rate (work rate - scope change rate) applied to remaining work
                </div>
              </div>
            )}

            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip content={({ active, payload, label }) => (
                    <CustomTooltip active={!!active} payload={payload} label={label} />
                  )} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalScope"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Total Scope (days)"
                  />
                  <Line
                    type="monotone"
                    dataKey="workDone"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Work Done (days)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Uploaded Files
              </h3>
              <div className="space-y-2">
                {getFilteredData().map((point, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {point.date.toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">{point.fileName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-blue-600">
                        {point.totalScope.toFixed(1)} days scope
                      </p>
                      <p className="font-medium text-purple-600">
                        {point.workDone.toFixed(1)} days done
                      </p>
                      <p className="text-sm text-gray-500">
                        {point.initiativeCount} initiatives
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 