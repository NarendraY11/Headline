import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/Atoms";
import { 
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw, 
  AlertCircle, Download, CheckCircle, XCircle 
} from "lucide-react";
import Papa from "papaparse";

interface CSVRow {
  id: string;
  subjectId: string;
  subcategoryId: string;
  ata: string;
  difficulty: string;
  prompt: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correct: string;
  explanation: string;
  references: string;
}

interface ValidationReport {
  rowNumber: number;
  id: string;
  isValid: boolean;
  errors: string[];
  data: any; // the formatted database record
}

export default function BulkImport() {
  const [subjects, setSubjects] = useState<Set<string>>(new Set());
  const [subcategories, setSubcategories] = useState<Set<string>>(new Set());
  const [existingDbIds, setExistingDbIds] = useState<Set<string>>(new Set());
  
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [successStatus, setSuccessStatus] = useState("");
  const [errorStatus, setErrorStatus] = useState("");
  
  const [reports, setReports] = useState<ValidationReport[]>([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchValidationDbState = async () => {
    setLoading(true);
    setReports([]);
    setFileName("");
    setErrorStatus("");
    setSuccessStatus("");
    try {
      // 1. Fetch Subjects
      const { data: subjs } = await supabase.from("subjects").select("id");
      setSubjects(new Set((subjs || []).map(s => s.id)));

      // 2. Fetch Subcategories
      const { data: subcats } = await supabase.from("subcategories").select("id");
      setSubcategories(new Set((subcats || []).map(s => s.id)));

      // 3. Fetch Existing Question IDs
      const { data: quests } = await supabase.from("questions").select("id");
      setExistingDbIds(new Set((quests || []).map(q => q.id)));

    } catch (err: any) {
      console.error("Bulk Import DB check lookup failed:", err);
      setErrorStatus("Failed to establish reference integrity constraints with Supabase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValidationDbState();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      parseCSV(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      parseCSV(file);
    }
  };

  const parseCSV = (file: File) => {
    setReports([]);
    setErrorStatus("");
    setSuccessStatus("");

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        validateRows(results.data);
      },
      error: (err) => {
        console.error("CSV Parse Failure:", err);
        setErrorStatus(`Parsing error encountered: ${err.message}`);
      }
    });
  };

  const validateRows = (rows: CSVRow[]) => {
    const fileIdsSeen = new Set<string>();
    const newReports: ValidationReport[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // Row numbers correspond to standard spreadsheet indexed views (header is 1)
      const errors: string[] = [];
      
      const id = row.id?.trim();
      const subjectId = row.subjectId?.trim();
      const subcategoryId = row.subcategoryId?.trim();
      const ata = row.ata?.trim() || "";
      const difficultyFromCSV = row.difficulty?.trim().toLowerCase() || "standard";
      const prompt = row.prompt?.trim();
      const choiceA = row.choiceA?.trim();
      const choiceB = row.choiceB?.trim();
      const choiceC = row.choiceC?.trim();
      const choiceD = row.choiceD?.trim();
      const correct = row.correct?.trim().toLowerCase();
      const explanation = row.explanation?.trim() || "";
      const referencesRaw = row.references?.trim() || "";

      // Mandatory field verification
      if (!id) errors.push("Question 'id' is required.");
      if (!subjectId) errors.push("Parent 'subjectId' is required.");
      if (!subcategoryId) errors.push("Nested 'subcategoryId' is required.");
      if (!prompt) errors.push("'prompt' query text is mandatory.");
      if (!choiceA || !choiceB || !choiceC || !choiceD) {
        errors.push("All four base choices (choiceA, choiceB, choiceC, choiceD) are required.");
      }
      if (!correct) errors.push("'correct' option key is required.");

      // Check format bounds
      if (correct && !["a", "b", "c", "d"].includes(correct)) {
        errors.push(`'correct' answer must be one of 'a', 'b', 'c', or 'd'. Found: "${correct}"`);
      }

      const diffTrimmed = ["standard", "complex", "extreme"].includes(difficultyFromCSV)
        ? (difficultyFromCSV as "standard" | "complex" | "extreme")
        : "standard" as const;

      // Referential Database integrity check lookup
      if (subjectId && !subjects.has(subjectId)) {
        errors.push(`Subject code "${subjectId}" does not exist in the DB.`);
      }
      if (subcategoryId && !subcategories.has(subcategoryId)) {
        errors.push(`Subcategory code "${subcategoryId}" does not exist in the DB.`);
      }

      // Duplication rules matching
      if (id) {
        if (fileIdsSeen.has(id)) {
          errors.push(`Duplicate ID encountered inside this file: "${id}"`);
        } else {
          fileIdsSeen.add(id);
        }

        if (existingDbIds.has(id)) {
          errors.push(`Question ID already exists in the live DB database: "${id}"`);
        }
      }

      const cleanRefs = referencesRaw
        ? referencesRaw.split("|").map(r => r.trim()).filter(Boolean)
        : [];

      const formattedRecord = {
        id,
        subject_id: subjectId,
        subcategory_id: subcategoryId,
        ata: ata || null,
        difficulty: diffTrimmed,
        prompt,
        choices: [
          { id: "a", label: choiceA || "" },
          { id: "b", label: choiceB || "" },
          { id: "c", label: choiceC || "" },
          { id: "d", label: choiceD || "" }
        ],
        correct: correct || "a",
        explanation,
        refs: cleanRefs,
        status: "draft", // Imported as draft per specification
        updated_at: new Date().toISOString()
      };

      newReports.push({
        rowNumber: rowNum,
        id: id || `Row-${rowNum}`,
        isValid: errors.length === 0,
        errors,
        data: formattedRecord
      });
    });

    setReports(newReports);
  };

  const handleCommitImport = async () => {
    const validData = reports.filter(r => r.isValid).map(r => r.data);
    if (validData.length === 0) return;

    setIsUploading(true);
    setErrorStatus("");
    setSuccessStatus("");

    try {
      const { error } = await supabase.from("questions").upsert(validData);
      if (error) throw error;

      setSuccessStatus(`Successfully imported and processed ${validData.length} questions into the supabase database! Setting status='draft'.`);
      setReports([]);
      setFileName("");
      
      // Refresh IDs cache
      const { data: quests } = await supabase.from("questions").select("id");
      setExistingDbIds(new Set((quests || []).map(q => q.id)));

    } catch (err: any) {
      console.error("Bulk commit supabase validation query error:", err);
      setErrorStatus(`Failed to execute bulk operation query: ${err.message || "Database write error."}`);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const headers = [
      "id",
      "subjectId",
      "subcategoryId",
      "ata",
      "difficulty",
      "prompt",
      "choiceA",
      "choiceB",
      "choiceC",
      "choiceD",
      "correct",
      "explanation",
      "references"
    ];

    // Attempt to match existing DB entries for parent IDs, else provide safe fallbacks
    const exampleSubj = (Array.from(subjects)[0] as string) || "aviation-navigation";
    const exampleSubcat = (Array.from(subcategories)[0] as string) || "navigation-calculations";

    const sampleRow: string[] = [
      "q-sample-test-01",
      exampleSubj,
      exampleSubcat,
      "ATA-34",
      "standard",
      "Calculated standard crosswind component given a 230 heading and runway 27 with wind reports of 310 at 15 knots?",
      "Roughly 11 knots",
      "Exactly 13 knots",
      "Roughly 9.6 knots",
      "More than 15 knots",
      "c",
      "Using crosswind resolution formula, 310 minus 270 is 40 degrees. Sin(40) * 15 knots is roughly 9.6 knots.",
      "FCOM NP-SF|FAA Flight Handbook"
    ];

    const csvString = [
      headers.join(","),
      sampleRow.map(v => `"${v.replace(/"/g, '""')}"`).join(",")
    ].join("\n");

    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "questions_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validCount = reports.filter(r => r.isValid).length;
  const invalidCount = reports.filter(r => !r.isValid).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 font-sans text-ink">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-[#00a3ff] uppercase mb-1 font-semibold">Database Sync Module</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">CSV Bulk Importer</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            onClick={fetchValidationDbState}
            disabled={loading}
            className="p-1 px-3 border border-rule hover:bg-bg-2 rounded-full text-ink font-semibold h-10 gap-1.5 text-xs"
            title="Refresh referential databases"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Clear / Reload Rules
          </Button>
          
          <Button
            variant="ghost"
            onClick={downloadCsvTemplate}
            className="px-4 py-2 bg-bg-2 border border-rule hover:bg-bg-3 text-xs text-ink rounded-full transition-all flex items-center gap-1.5 cursor-pointer h-10 font-semibold"
          >
            <Download size={13} />
            <span>Download CSV Template</span>
          </Button>
        </div>
      </div>

      {errorStatus && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-3">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorStatus}</span>
        </div>
      )}

      {successStatus && (
        <div className="p-4 bg-mint/15 border border-mint/40 text-emerald-800 rounded-lg text-xs flex items-center gap-3">
          <CheckCircle2 size={16} className="shrink-0 animate-pulse" />
          <span>{successStatus}</span>
        </div>
      )}

      {loading ? (
        <div className="h-[250px] flex flex-col items-center justify-center bg-white border border-rule rounded-xl">
          <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-xs text-muted tracking-widest uppercase">Initializing Schema Validators...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel: CSV Drag Drop Workspace input */}
          <div className="lg:col-span-5 space-y-5">
            <div className="font-mono text-[10px] uppercase text-ink tracking-widest font-bold">
              1. Drop Question Catalog File
            </div>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-rule hover:border-ink rounded-2xl p-8 bg-white cursor-pointer transition-colors text-center flex flex-col justify-center items-center h-52 group select-none"
            >
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-ink/5 text-muted-2 flex items-center justify-center mb-4 group-hover:scale-105 transition-all">
                <FileSpreadsheet size={24} />
              </div>
              <p className="font-sans font-semibold text-xs text-ink">
                {fileName ? fileName : "Drag and drop question list .csv here"}
              </p>
              <p className="font-mono text-[9px] text-muted-2 uppercase mt-1 tracking-widest">
                Or click to browse storage files
              </p>
            </div>

            {reports.length > 0 && (
              <div className="bg-bg p-4 border border-rule rounded-xl space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <div className="font-mono uppercase tracking-wide font-bold text-muted-2 text-[10px]">
                    ANALYSIS WORKSPACE
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-wider font-semibold">
                    {reports.length} Rows Processed
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="border border-mint/30 bg-mint/5 p-3 rounded-lg">
                    <div className="text-xl font-mono font-bold text-emerald-800">{validCount}</div>
                    <div className="font-sans text-[10px] text-emerald-700 font-semibold uppercase mt-1">Valid Rows OK</div>
                  </div>
                  <div className="border border-rose-200 bg-rose-50 p-3 rounded-lg">
                    <div className="text-xl font-mono font-bold text-rose-800">{invalidCount}</div>
                    <div className="font-sans text-[10px] text-rose-700 font-semibold uppercase mt-1">Errors Found</div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  onClick={handleCommitImport}
                  disabled={isUploading || validCount === 0}
                  className="w-full h-11 text-xs gap-1.5 uppercase font-mono tracking-wider justify-center"
                >
                  {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>Import {validCount} Valid Rows ('draft')</span>
                </Button>
              </div>
            )}
          </div>

          {/* Right Panel: Live report list validation table */}
          <div className="lg:col-span-7 space-y-5">
            <div className="font-mono text-[10px] uppercase text-ink tracking-widest font-bold flex justify-between items-center">
              <span>2. VERIFICATION MATRIX REPORT</span>
              {reports.length > 0 && (
                <span className="text-[9px] bg-bg border border-rule py-0.5 px-2.5 rounded font-mono lowercase">verified files</span>
              )}
            </div>

            {reports.length === 0 ? (
              <div className="border border-rule rounded-xl bg-white p-12 text-center font-mono select-none flex flex-col items-center justify-center h-52">
                <AlertTriangle className="text-muted-2 mb-2" size={28} />
                <p className="text-[10px] text-muted-2 uppercase tracking-widest">Awaiting CSV Source Upload...</p>
                <p className="text-[8px] text-muted mt-2 max-w-sm uppercase leading-relaxed">
                  Use the headers template format, drop your file, and immediately diagnose structural anomalies here in real-time.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-rule rounded-xl overflow-hidden shadow-sm max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[9px] bg-bg-2/50 sticky top-0">
                      <th className="py-2.5 px-3 font-semibold w-16">Row #</th>
                      <th className="py-2.5 px-3 font-semibold w-32">Target ID</th>
                      <th className="py-2.5 px-3 font-semibold w-24 text-center">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Anomalies & Reason Logs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((rep) => (
                      <tr 
                        key={rep.rowNumber} 
                        className={`border-b border-rule/50 hover:bg-bg-2/20 transition-colors ${!rep.isValid ? "bg-rose-50/20" : ""}`}
                      >
                        <td className="py-2.5 px-3 font-mono text-muted text-[10px]">
                          #{rep.rowNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-ink text-[11px] truncate max-w-[120px]" title={rep.id}>
                          {rep.id}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {rep.isValid ? (
                            <span className="inline-flex items-center gap-1 bg-mint/10 border border-mint/20 text-emerald-800 text-[8px] font-bold font-mono px-2 py-0.5 rounded-full uppercase">
                              <CheckCircle size={9} /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-100 text-rose-700 text-[8px] font-bold font-mono px-2 py-0.5 rounded-full uppercase">
                              <XCircle size={9} /> ERROR
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-ink font-sans leading-relaxed">
                          {rep.isValid ? (
                            <span className="text-muted italic text-[10px]">Ready for database commit. Unlocked.</span>
                          ) : (
                            <div className="space-y-1 py-1">
                              {rep.errors.map((err, errIdx) => (
                                <div key={errIdx} className="text-rose-600 font-medium flex items-start gap-1">
                                  <span className="font-mono text-rose-400 select-none">•</span>
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
