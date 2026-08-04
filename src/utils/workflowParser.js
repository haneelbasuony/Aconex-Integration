/**
 * ============================================================================
 * ACONEX WORKFLOW XML PARSER
 * ============================================================================
 *
 * Converts:
 *
 * <Workflow WorkflowId="...">
 *     ...
 * </Workflow>
 *
 * into SQL-ready JavaScript objects.
 *
 * The output field names intentionally match the SQL column names.
 * ============================================================================
 */

"use strict";

const { parseStringPromise } = require("xml2js");

/**
 * Safely get a value from an XML node.
 */
function getValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed === "" ? null : trimmed;
  }

  return value;
}

/**
 * Convert an XML object into JSON.
 *
 * Used for nested structures such as:
 *
 * Assignees
 * Initiator
 * Reviewer
 */
function objectToJson(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.stringify(value);
}

/**
 * Parse one <Workflow> XML object.
 */
function flattenWorkflow(workflow, projectId) {
  if (!workflow || typeof workflow !== "object") {
    return null;
  }

  /*
   * WorkflowId is an XML ATTRIBUTE:
   *
   * <Workflow WorkflowId="123">
   *
   * Because xml2js is configured with mergeAttrs=true,
   * it appears directly as:
   *
   * workflow.WorkflowId
   */
  const workflowId = getValue(workflow.WorkflowId);

if (!workflowId) {
  return null;
}

const assignees = workflow.Assignees?.Assignee;

const assigneeList = Array.isArray(assignees)
  ? assignees
  : assignees
    ? [assignees]
    : [];

return {
    // ------------------------------------------------------------------------
    // Keys
    // ------------------------------------------------------------------------

    projectId: String(projectId),

    workflowId: workflowId,

    // ------------------------------------------------------------------------
    // Workflow information
    // ------------------------------------------------------------------------

assigneesName:
  assigneeList
    .map(a => a.Name)
    .filter(Boolean)
    .join(": ") || null,

assigneesId:
  assigneeList
    .map(a => a.UserId)
    .filter(Boolean)
    .join(": ") || null,


    comments: getValue(workflow.Comments),

    dateCompleted: getValue(workflow.DateCompleted),

    dateDue: getValue(workflow.DateDue),

    dateIn: getValue(workflow.DateIn),

    daysLate: getValue(workflow.DaysLate),

    // ------------------------------------------------------------------------
    // Document information
    // ------------------------------------------------------------------------

    documentNumber: getValue(workflow.DocumentNumber),

    documentRevision: getValue(workflow.DocumentRevision),

    documentTitle: getValue(workflow.DocumentTitle),

    documentTrackingId: getValue(workflow.DocumentTrackingId),

    documentVersion: getValue(workflow.DocumentVersion),

    // ------------------------------------------------------------------------
    // File information
    // ------------------------------------------------------------------------

    duration: getValue(workflow.Duration),

    fileName: getValue(workflow.FileName),

    fileSize: getValue(workflow.FileSize),

    // ------------------------------------------------------------------------
    // People
    // ------------------------------------------------------------------------

    initiatorName: getValue(workflow.Initiator?.Name),

    initiatorId: getValue(workflow.Initiator?.UserId),

    reviewerName: getValue(workflow.Reviewer?.Name),

    reviewerId: getValue(workflow.Reviewer?.UserId),

    // ------------------------------------------------------------------------
    // Dates
    // ------------------------------------------------------------------------

    originalDueDate: getValue(workflow.OriginalDueDate),

    // ------------------------------------------------------------------------
    // Workflow process
    // ------------------------------------------------------------------------

    reasonForIssue: getValue(workflow.ReasonForIssue),

    stepName: getValue(workflow.StepName),

    stepOutcome: getValue(workflow.StepOutcome),

    stepStatus: getValue(workflow.StepStatus),

    workflowName: getValue(workflow.WorkflowName),

    workflowNumber: getValue(workflow.WorkflowNumber),

    workflowStatus: getValue(workflow.WorkflowStatus),

    workflowTemplate: getValue(workflow.WorkflowTemplate),
  };
}

/**
 * Parse one XML page.
 */
async function parseWorkflowXml(xml, projectId) {
  if (!xml || typeof xml !== "string") {
    throw new Error("Workflow XML response is empty or invalid.");
  }

  const parsed = await parseStringPromise(xml, {
    explicitArray: false,

    mergeAttrs: true,

    explicitRoot: true,

    trim: true,
  });

  /*
   * Expected structure:
   *
   * WorkflowSearch
   *     SearchResults
   *         Workflow
   *
   */

  const workflowSearch = parsed.WorkflowSearch;

  if (!workflowSearch) {
    throw new Error(
      "Workflow XML does not contain WorkflowSearch root element.",
    );
  }

  const searchResults = workflowSearch.SearchResults;

  if (!searchResults) {
    return [];
  }

  let workflows = searchResults.Workflow;

  if (!workflows) {
    return [];
  }

  /*
   * If there is only one Workflow,
   * xml2js gives us an object.
   *
   * If there are multiple Workflows,
   * xml2js gives us an array.
   *
   * Normalize both cases to an array.
   */
  if (!Array.isArray(workflows)) {
    workflows = [workflows];
  }

  const rows = [];

  for (const workflow of workflows) {
    const row = flattenWorkflow(workflow, projectId);

    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse multiple XML pages.
 */
async function parseWorkflowPages(xmlPages, projectId) {
  const allRows = [];

  for (const xml of xmlPages) {
    const rows = await parseWorkflowXml(xml, projectId);

    allRows.push(...rows);
  }

  return allRows;
}

module.exports = {
  parseWorkflowXml,
  parseWorkflowPages,
  flattenWorkflow,
};
