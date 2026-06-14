from collections import defaultdict
from datetime import date, datetime

WEEKDAY_ZH = ("周一", "周二", "周三", "周四", "周五", "周六", "周日")


def format_duration(seconds: int | None) -> str | None:
    if seconds is None:
        return None
    h = seconds // 3600
    m = (seconds % 3600) // 60
    if h > 0 and m > 0:
        return f"{h}小时{m}分"
    if h > 0:
        return f"{h}小时"
    if m > 0:
        return f"{m}分"
    return "0分"


def format_date_desc(date_str: str) -> str:
    d = date.fromisoformat(date_str)
    return f"{d.month}月{d.day}日·{WEEKDAY_ZH[d.weekday()]}"


def _entry_item(row) -> dict:
    item: dict = {"事情": row["task_name"]}
    duration = format_duration(row["duration_seconds"])
    item["耗时"] = duration if duration else "未记录"
    if row["notes"]:
        item["想法"] = row["notes"]
    return item


def build_llm_export(rows) -> dict:
    by_date: dict[str, list] = defaultdict(list)
    task_stats: dict[str, dict] = defaultdict(lambda: {"次数": 0, "秒": 0})
    total_seconds = 0
    dated_entries = 0

    for row in rows:
        by_date[row["recorded_date"]].append(row)
        task_stats[row["task_name"]]["次数"] += 1
        sec = row["duration_seconds"]
        if sec:
            task_stats[row["task_name"]]["秒"] += sec
            total_seconds += sec
        dated_entries += 1

    dates = sorted(by_date.keys())
    date_range = None
    if dates:
        date_range = f"{dates[0]} 至 {dates[-1]}" if len(dates) > 1 else dates[0]

    task_summary = []
    for name, stat in sorted(task_stats.items(), key=lambda x: x[1]["秒"], reverse=True):
        entry: dict = {"事情": name, "次数": stat["次数"]}
        if stat["秒"] > 0:
            entry["累计耗时"] = format_duration(stat["秒"])
            if total_seconds > 0:
                entry["耗时占比"] = f"{round(stat['秒'] / total_seconds * 100)}%"
        task_summary.append(entry)

    daily_records = []
    for day in sorted(by_date.keys(), reverse=True):
        day_rows = by_date[day]
        day_seconds = sum(r["duration_seconds"] or 0 for r in day_rows)
        daily_records.append(
            {
                "日期": day,
                "日期描述": format_date_desc(day),
                "当日合计": format_duration(day_seconds) if day_seconds else "未记录",
                "记录": [_entry_item(r) for r in day_rows],
            }
        )

    return {
        "数据说明": {
            "来源": "Lyube 个人时间记录",
            "记录方式": "柳比歇夫式时间统计：用户记下「做了什么」和「花了多久」，可选补充「想法」",
            "给 AI 的提示": (
                "请根据下方记录分析用户的时间分配、习惯、关注领域与变化趋势。"
                "「耗时」为用户的自我估算，可能为空；「想法」为可选备注，出现时表示用户有额外说明。"
            ),
            "导出时间": datetime.now().strftime("%Y年%m月%d日 %H:%M"),
        },
        "记录概况": {
            "总条数": dated_entries,
            "有记录天数": len(by_date),
            "日期范围": date_range,
            "累计耗时": format_duration(total_seconds) if total_seconds else "未记录",
            "按事情汇总": task_summary,
        },
        "按日记录": daily_records,
    }
