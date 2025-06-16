"use client";

import { useState, useCallback } from "react";

// utils
import { Initiative, InitiativesForMonth } from "./types";
import { format } from "date-fns";
import { getToday } from "./dates";
import { parseCsvToInitiatives } from "./csv";
import { groupInitiativesByMonth } from "./summary";

// components
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useDropzone } from "react-dropzone";

// smple data
import { sampleCSVData } from "./sample-data";

// --- React Components ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
        <p className="font-bold text-gray-800">{`Month: ${label}`}</p>
        <p className="text-sm text-blue-500">{`Work Due: ${data.work} days`}</p>
        <p className="text-sm text-green-500">{`Capacity: ${data.capacity} days`}</p>
        <p
          className={`text-sm font-semibold ${
            data.work > data.capacity ? "text-red-500" : "text-green-600"
          }`}
        >
          {data.work > data.capacity
            ? `Over Capacity by ${data.work - data.capacity} days`
            : `Under Capacity by ${data.capacity - data.work} days`}
        </p>
        <div className="mt-2 pt-2 border-t border-gray-200">
          <h4 className="font-semibold text-xs text-gray-600 mb-1">
            Initiatives due this month:
          </h4>
          <ul className="list-disc list-inside text-xs text-gray-500">
            {data.initiatives.map((i) => (
              <li key={i.name}>{i.name}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  return null;
};

const AllInitiativesView = ({
  initiatives,
  teamCapacityPerMonth = 120,
  onBack,
}: {
  initiatives: Initiative[];
  teamCapacityPerMonth?: number;
  onBack: () => void;
}) => {
  const totalOnTrackStatusInDays = initiatives.reduce(
    (acc, initiative) => acc + (initiative.onTrackStatus || 0),
    0
  );

  const totalMonthsOnTrackStatus =
    totalOnTrackStatusInDays / teamCapacityPerMonth;

  const handleDownload = () => {
    const headers = [
      "Initiative Name",
      "Status",
      "Work Done",
      "Work Due",
      "Total Work",
      "% Complete",
      "% Expected Complete",
      "Target Finish Date",
      "Projected Finish Date",
      "On track / Off track (days)",
      "Customer",
    ];

    const rows = initiatives.map((i) => {
      // Function to safely wrap a value in quotes for CSV
      const escapeCsv = (val) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escapeCsv(i.name),
        escapeCsv(i.status),
        Math.round(i.doneWork),
        Math.round(i.workDays),
        Math.round(i.totalWork),
        `${Math.round(i.percentComplete)}%`,
        `${Math.round(i.expectedCompletion)}%`,
        format(new Date(i.targetDate), "yyyy-MM-dd"),
        format(new Date(i.projectedFinishDate), "yyyy-MM-dd"),
        i.onTrackStatus,
        escapeCsv(i.customer),
      ].join(",");
    });

    const csvString = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "all_initiatives_export.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg
            className="-ml-1 mr-2 h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Back to Overview
        </button>
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-800">
            All Initiatives
          </h3>
          <div>
            <span className="text-sm font-medium text-gray-500">
              Overall Months Ahead/Behind:{" "}
            </span>
            <span
              className={`text-lg font-bold ${
                totalMonthsOnTrackStatus < 0 ? "text-red-500" : "text-green-600"
              }`}
            >
              {totalMonthsOnTrackStatus >= 0
                ? `+${totalMonthsOnTrackStatus.toFixed(1)}`
                : totalMonthsOnTrackStatus.toFixed(1)}
            </span>
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Download CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Initiative Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Work Done
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Work Due
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Total Work
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                % Complete
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                % Expected Complete
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Target Finish Date
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Projected Finish Date
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                On track / Off track (days)
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Customer
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {initiatives.map((initiative) => (
              <tr key={initiative.name}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {initiative.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {initiative.status}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {Math.round(initiative.doneWork)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {Math.round(initiative.workDays)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {Math.round(initiative.totalWork)}
                </td>
                <td
                  className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                    initiative.expectedCompletion > initiative.percentComplete
                      ? "text-red-500"
                      : "text-green-600"
                  }`}
                >
                  {Math.round(initiative.percentComplete)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {Math.round(initiative.expectedCompletion)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(initiative.targetDate), "MMM d, yy")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(
                    new Date(initiative.projectedFinishDate),
                    "MMM d, yy"
                  )}
                </td>
                <td
                  className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                    initiative.onTrackStatus < 0
                      ? "text-red-500"
                      : "text-green-600"
                  }`}
                >
                  {initiative.onTrackStatus > 0
                    ? `+${initiative.onTrackStatus}`
                    : initiative.onTrackStatus}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {initiative.customer}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DrilldownView = ({
  monthData,
  onBack,
}: {
  monthData: InitiativesForMonth;
  onBack: () => void;
}) => {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <svg
          className="-ml-1 mr-2 h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Back to Overview
      </button>
      <h3 className="text-xl font-semibold mb-4 text-gray-800">
        Initiatives Due in {monthData.name}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Initiative Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Work Done
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Work Due
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Total Work
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                % Complete
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                % Expected Complete
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Target Finish Date
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Projected Finish Date
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                On track / Off track (days)
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Customer
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {monthData.initiatives
              .sort((a, b) => a.onTrackStatus - b.onTrackStatus)
              .map((initiative) => (
                <tr key={initiative.name}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {initiative.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {Math.round(initiative.doneWork)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {initiative.status}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {Math.round(initiative.workDays)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {Math.round(initiative.totalWork)}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                      initiative.expectedCompletion > initiative.percentComplete
                        ? "text-red-500"
                        : "text-green-600"
                    }`}
                  >
                    {Math.round(initiative.percentComplete)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {Math.round(initiative.expectedCompletion)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(initiative.targetDate), "MMM d, yy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(
                      new Date(initiative.projectedFinishDate),
                      "MMM d, yy"
                    )}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                      initiative.onTrackStatus < 0
                        ? "text-red-500"
                        : "text-green-600"
                    }`}
                  >
                    {initiative.onTrackStatus > 0
                      ? `+${initiative.onTrackStatus}`
                      : initiative.onTrackStatus}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {initiative.customer}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function JiraCapacityPlanner() {
  const [data, setData] = useState<InitiativesForMonth[]>([]);
  const [fileName, setFileName] = useState<string>();
  const [error, setError] = useState<string>();
  const [selectedMonthData, setSelectedMonthData] = useState(null);
  const [page, setPage] = useState("home");
  const [allInitiatives, setAllInitiatives] = useState<Initiative[]>([]);

  const TEAM_CAPACITY_PER_MONTH = 120;

  const handleBarClick = (data) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      setSelectedMonthData(data.activePayload[0].payload);
    }
  };
  const handleBackToOverview = () => {
    setSelectedMonthData(null);
    setPage("home");
  };

  const processData = useCallback(
    (csvString: string) => {
      setError(undefined);
      setSelectedMonthData(null);
      setPage("home");
      const today = getToday();
      const parseResult = parseCsvToInitiatives(today, csvString);
      if (parseResult.outcome === "error") {
        setData([]);
        setAllInitiatives([]);
        setError(parseResult.error);
        return;
      }
      if (parseResult.initiatives.length === 0) {
        setError(
          "No valid initiatives found in the CSV file. Please check the data."
        );
        setData([]);
        setAllInitiatives([]);
        return;
      }
      const chartData = groupInitiativesByMonth(
        today,
        parseResult.initiatives,
        TEAM_CAPACITY_PER_MONTH
      );
      setAllInitiatives(parseResult.initiatives);
      setData(chartData);
    },
    [
      setError,
      setSelectedMonthData,
      setPage,
      setData,
      setAllInitiatives,
      getToday,
      parseCsvToInitiatives,
      groupInitiativesByMonth,
    ]
  );

  const onDrop = useCallback(
    (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
          processData(event.target?.result as string);
        };
        reader.readAsText(file);
      }
    },
    [processData]
  );

  const handleSampleData = () => {
    setFileName("sample-data.csv");
    processData(sampleCSVData);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
  });

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Monthly Initiative Planner
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Visualize your team's monthly workload against its capacity (120
            days per month).
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {page === "home" && !selectedMonthData && (
            <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-md border border-gray-200">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                Upload Data
              </h2>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-all duration-300 ${
                  isDragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-gray-50 cursor-pointer"
                }`}
              >
                <input {...getInputProps()} />
                {isDragActive ? (
                  <p className="text-blue-600">Drop the CSV file here ...</p>
                ) : (
                  <div>
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="font-semibold text-blue-600">
                        Drag & drop a .csv file
                      </span>{" "}
                      or click to select
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Columns: Summary, Project target, etc.
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-4 text-center">
                <button
                  onClick={handleSampleData}
                  className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {"Or Use Sample Data"}
                </button>
              </div>

              {fileName && (
                <p className="mt-4 text-sm text-center text-gray-500">
                  File:{" "}
                  <span className="font-medium text-gray-700">{fileName}</span>
                </p>
              )}
              {error && (
                <div
                  className="mt-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md"
                  role="alert"
                >
                  <p className="font-bold">Error</p>
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}

          <div
            className={`bg-white p-6 rounded-xl shadow-md border border-gray-200 ${
              page === "home" && !selectedMonthData
                ? "lg:col-span-2"
                : "lg:col-span-3"
            }`}
          >
            {selectedMonthData ? (
              <DrilldownView
                monthData={selectedMonthData}
                onBack={handleBackToOverview}
              />
            ) : page === "all" ? (
              <AllInitiativesView
                initiatives={allInitiatives}
                onBack={handleBackToOverview}
                teamCapacityPerMonth={TEAM_CAPACITY_PER_MONTH}
              />
            ) : (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Capacity vs Work Due Date
                  </h2>
                  {allInitiatives.length > 0 && (
                    <button
                      onClick={() => setPage("all")}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      View All Initiatives &rarr;
                    </button>
                  )}
                </div>
                {data.length > 0 ? (
                  <div style={{ width: "100%", height: 400 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={data}
                        margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                        onClick={handleBarClick}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis
                          label={{
                            value: "Work Days",
                            angle: -90,
                            position: "insideLeft",
                            offset: 10,
                            style: { textAnchor: "middle" },
                          }}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => (
                            <CustomTooltip
                              active={active}
                              payload={payload}
                              label={label}
                            />
                          )}
                          cursor={{ fill: "rgba(239, 246, 255, 0.5)" }}
                        />
                        <Legend wrapperStyle={{ paddingTop: "20px" }} />
                        <ReferenceLine
                          y={TEAM_CAPACITY_PER_MONTH}
                          label={{
                            value: "Capacity",
                            position: "insideTopRight",
                            fill: "#16a34a",
                            fontSize: 12,
                            fontWeight: "bold",
                          }}
                          stroke="#16a34a"
                          strokeDasharray="4 4"
                        />
                        <Bar
                          dataKey="work"
                          name="Work Due"
                          fill="#3b82f6"
                          cursor="pointer"
                        >
                          {data.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.work > entry.capacity
                                  ? "#ef4444"
                                  : "#3b82f6"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 min-h-[400px]">
                    <p>Upload a CSV or use sample data to see the chart.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <footer className="text-center mt-12 text-sm text-gray-400">
          <p>
            A simple capacity planning tool. Assigns total work to the month of
            the 'Project target' date.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default JiraCapacityPlanner;
