export function showHome(): void {
  window.location.href = "/";
}

export function showResults(): void {
  const mainHome = document.getElementById("main-home");
  const resultsPage = document.getElementById("results-page");
  const header = document.getElementById("header");
  if (mainHome) mainHome.style.display = "none";
  if (resultsPage) resultsPage.style.display = "";
  if (header) header.style.display = "none";
  document.body.classList.add("has-results");
}

export function setActiveTab(type: string): void {
  document.querySelectorAll<HTMLElement>(".results-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.type === type);
  });
}
