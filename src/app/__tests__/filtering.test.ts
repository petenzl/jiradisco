import { Initiative } from "../types";

// Mock data for testing
const mockInitiatives: Initiative[] = [
  {
    name: "Project Alpha",
    status: "In Progress",
    doneWork: 15.7,
    workDays: 25.3,
    totalWork: 41.0,
    percentComplete: 38.3,
    expectedCompletion: 45.2,
    targetDate: new Date("2024-07-15"),
    projectedFinishDate: new Date("2024-08-20"),
    onTrackStatus: -5,
    customer: "Client A"
  },
  {
    name: "Project Beta",
    status: "Completed",
    doneWork: 30.0,
    workDays: 0,
    totalWork: 30.0,
    percentComplete: 100.0,
    expectedCompletion: 100.0,
    targetDate: new Date("2024-06-30"),
    projectedFinishDate: new Date("2024-06-30"),
    onTrackStatus: 0,
    customer: "Client B"
  },
  {
    name: "Project Gamma",
    status: "Planning",
    doneWork: 5.2,
    workDays: 45.8,
    totalWork: 51.0,
    percentComplete: 10.2,
    expectedCompletion: 12.5,
    targetDate: new Date("2024-09-15"),
    projectedFinishDate: new Date("2024-10-10"),
    onTrackStatus: 10,
    customer: "Client C"
  },
  {
    name: "Project Delta",
    status: "On Hold",
    doneWork: 0,
    workDays: 60.0,
    totalWork: 60.0,
    percentComplete: 0.0,
    expectedCompletion: 0.0,
    targetDate: new Date("2024-08-01"),
    projectedFinishDate: new Date("2024-09-15"),
    onTrackStatus: -15,
    customer: "Client A"
  }
];

// Mock filtering and sorting functions (simplified versions of the actual logic)
const filterInitiatives = (
  initiatives: Initiative[],
  filters: { [key in keyof Initiative]?: string }
): Initiative[] => {
  return initiatives.filter(initiative => {
    return Object.entries(filters).every(([key, filterValue]) => {
      if (!filterValue) return true;
      const initiativeValue = initiative[key as keyof Initiative];
      
      // For numeric fields that are displayed as rounded values
      if (key === 'doneWork' || key === 'workDays' || key === 'totalWork') {
        const roundedValue = Math.round(initiativeValue as number);
        return String(roundedValue).includes(filterValue);
      }
      
      // For date fields, convert to formatted string for filtering
      if (key === 'targetDate' || key === 'projectedFinishDate') {
        const dateValue = new Date(initiativeValue as string);
        const formattedDate = dateValue.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: '2-digit'
        });
        return formattedDate.toLowerCase().includes(filterValue.toLowerCase());
      }
      
      if (typeof initiativeValue === 'string') {
        return initiativeValue.toLowerCase().includes(filterValue.toLowerCase());
      }
      if (typeof initiativeValue === 'number') {
        return String(initiativeValue).includes(filterValue);
      }
      return true;
    });
  });
};

const sortInitiatives = (
  initiatives: Initiative[],
  sortConfig: { key: keyof Initiative | null; direction: 'asc' | 'desc' }
): Initiative[] => {
  if (!sortConfig.key) return initiatives;
  
  return [...initiatives].sort((a, b) => {
    const aValue = a[sortConfig.key!];
    const bValue = b[sortConfig.key!];
    
    // Handle date sorting
    if (sortConfig.key === 'targetDate' || sortConfig.key === 'projectedFinishDate') {
      const aDate = new Date(aValue as string);
      const bDate = new Date(bValue as string);
      const comparison = aDate.getTime() - bDate.getTime();
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    }
    
    // Handle numeric sorting
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      const comparison = aValue - bValue;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    }
    
    // Handle string sorting
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    }
    
    return 0;
  });
};

describe("Filtering and Sorting Functionality", () => {
  describe("Filtering", () => {
    test("should filter by initiative name", () => {
      const filters = { name: "Alpha" };
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Project Alpha");
    });

    test("should filter by status", () => {
      const filters = { status: "Completed" };
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("Completed");
    });

    test("should filter by customer", () => {
      const filters = { customer: "Client A" };
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(2);
      expect(result.map(i => i.name)).toEqual(["Project Alpha", "Project Delta"]);
    });

    test("should filter by rounded work done value", () => {
      const filters = { doneWork: "16" }; // 15.7 rounds to 16
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Project Alpha");
    });

    test("should filter by rounded work due value", () => {
      const filters = { workDays: "46" }; // 45.8 rounds to 46
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Project Gamma");
    });

    test("should filter by rounded total work value", () => {
      const filters = { totalWork: "41" }; // 41.0 rounds to 41
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Project Alpha");
    });

    test("should filter by target date month", () => {
      const filters = { targetDate: "Jul" };
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Project Alpha");
    });

    test("should filter by projected finish date month", () => {
      const filters = { projectedFinishDate: "Aug" };
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(1);
      expect(result.map(i => i.name)).toEqual(["Project Alpha"]);
    });

    test("should return all initiatives when no filters applied", () => {
      const filters = {};
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(4);
    });

    test("should handle case-insensitive filtering", () => {
      const filters = { name: "alpha" };
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Project Alpha");
    });

    test("should handle multiple filters", () => {
      const filters = { customer: "Client A", status: "In Progress" };
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Project Alpha");
    });
  });

  describe("Sorting", () => {
    test("should sort by name ascending", () => {
      const sortConfig = { key: 'name' as keyof Initiative, direction: 'asc' as const };
      const result = sortInitiatives(mockInitiatives, sortConfig);
      expect(result.map(i => i.name)).toEqual([
        "Project Alpha",
        "Project Beta", 
        "Project Delta",
        "Project Gamma"
      ]);
    });

    test("should sort by name descending", () => {
      const sortConfig = { key: 'name' as keyof Initiative, direction: 'desc' as const };
      const result = sortInitiatives(mockInitiatives, sortConfig);
      expect(result.map(i => i.name)).toEqual([
        "Project Gamma",
        "Project Delta",
        "Project Beta",
        "Project Alpha"
      ]);
    });

    test("should sort by work done ascending", () => {
      const sortConfig = { key: 'doneWork' as keyof Initiative, direction: 'asc' as const };
      const result = sortInitiatives(mockInitiatives, sortConfig);
      expect(result.map(i => i.doneWork)).toEqual([0, 5.2, 15.7, 30.0]);
    });

    test("should sort by work done descending", () => {
      const sortConfig = { key: 'doneWork' as keyof Initiative, direction: 'desc' as const };
      const result = sortInitiatives(mockInitiatives, sortConfig);
      expect(result.map(i => i.doneWork)).toEqual([30.0, 15.7, 5.2, 0]);
    });

    test("should sort by target date ascending", () => {
      const sortConfig = { key: 'targetDate' as keyof Initiative, direction: 'asc' as const };
      const result = sortInitiatives(mockInitiatives, sortConfig);
      expect(result.map(i => i.name)).toEqual([
        "Project Beta",    // 2024-06-30
        "Project Alpha",   // 2024-07-15
        "Project Delta",   // 2024-08-01
        "Project Gamma"    // 2024-09-15
      ]);
    });

    test("should sort by target date descending", () => {
      const sortConfig = { key: 'targetDate' as keyof Initiative, direction: 'desc' as const };
      const result = sortInitiatives(mockInitiatives, sortConfig);
      expect(result.map(i => i.name)).toEqual([
        "Project Gamma",   // 2024-09-15
        "Project Delta",   // 2024-08-01
        "Project Alpha",   // 2024-07-15
        "Project Beta"     // 2024-06-30
      ]);
    });

    test("should sort by projected finish date ascending", () => {
      const sortConfig = { key: 'projectedFinishDate' as keyof Initiative, direction: 'asc' as const };
      const result = sortInitiatives(mockInitiatives, sortConfig);
      expect(result.map(i => i.name)).toEqual([
        "Project Beta",    // 2024-06-30
        "Project Alpha",   // 2024-08-20
        "Project Delta",   // 2024-09-15
        "Project Gamma"    // 2024-10-10
      ]);
    });

    test("should sort by on track status ascending", () => {
      const sortConfig = { key: 'onTrackStatus' as keyof Initiative, direction: 'asc' as const };
      const result = sortInitiatives(mockInitiatives, sortConfig);
      expect(result.map(i => i.onTrackStatus)).toEqual([-15, -5, 0, 10]);
    });

    test("should return original order when no sort config", () => {
      const sortConfig = { key: null, direction: 'asc' as const };
      const result = sortInitiatives(mockInitiatives, sortConfig);
      expect(result).toEqual(mockInitiatives);
    });
  });

  describe("Combined Filtering and Sorting", () => {
    test("should filter then sort", () => {
      const filters = { customer: "Client A" };
      const sortConfig = { key: 'name' as keyof Initiative, direction: 'asc' as const };
      
      const filtered = filterInitiatives(mockInitiatives, filters);
      const result = sortInitiatives(filtered, sortConfig);
      
      expect(result.map(i => i.name)).toEqual(["Project Alpha", "Project Delta"]);
    });

    test("should handle empty filtered results", () => {
      const filters = { name: "NonExistent" };
      const sortConfig = { key: 'name' as keyof Initiative, direction: 'asc' as const };
      
      const filtered = filterInitiatives(mockInitiatives, filters);
      const result = sortInitiatives(filtered, sortConfig);
      
      expect(result).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty initiatives array", () => {
      const filters = { name: "test" };
      const result = filterInitiatives([], filters);
      expect(result).toHaveLength(0);
    });

    test("should handle null/undefined filter values", () => {
      const filters = { name: "", status: null as string | null };
      const result = filterInitiatives(mockInitiatives, filters);
      expect(result).toHaveLength(4); // Should return all initiatives
    });

    test("should handle special characters in filter values", () => {
      const initiativesWithSpecialChars = [
        { ...mockInitiatives[0], name: "Project Alpha (v2.0)" }
      ];
      const filters = { name: "(v2" };
      const result = filterInitiatives(initiativesWithSpecialChars, filters);
      expect(result).toHaveLength(1);
    });
  });
});

