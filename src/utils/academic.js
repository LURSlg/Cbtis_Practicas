function getCurrentAcademicPeriod() {
    const now = new Date();
    const month = now.getMonth() + 1;
    let periodYearFull, suffix;
    if (month >= 8) {
        periodYearFull = now.getFullYear();
        suffix = 1;
    } else {
        periodYearFull = now.getFullYear() - 1;
        suffix = 2;
    }
    const yy = String(periodYearFull).slice(-2);
    return { yearFull: periodYearFull, yearShort: yy, suffix, period: `${yy}-${suffix}` };
}

function entryYearFromControl(control) {
    const two = String(control).slice(0, 2);
    return 2000 + parseInt(two, 10);
}

function computeCurrentSemesterForStudent(control) {
    const entryYear = entryYearFromControl(control);
    const period = getCurrentAcademicPeriod();
    const periodYear = period.yearFull;
    const suffix = period.suffix;
    let sem = (periodYear - entryYear) * 2 + (suffix === 1 ? 1 : 2);
    if (sem < 1) sem = 1;
    if (sem > 6) sem = 6;
    return sem;
}

module.exports = { getCurrentAcademicPeriod, computeCurrentSemesterForStudent };