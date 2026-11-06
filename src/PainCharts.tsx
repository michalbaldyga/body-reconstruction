import {
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { sites, type PainLog } from "./domain";

const WIDTH = 400,
  HEIGHT = 210,
  LEFT = 32,
  RIGHT = 382,
  TOP = 14,
  BOTTOM = 174;
const dayTime = (log: PainLog) => Date.parse(log.date + "T00:00:00Z");
const shortDate = (log: PainLog) =>
  new Date(log.date + "T12:00:00").toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  });
function PainChart({
  logs,
  site,
  color,
}: {
  logs: PainLog[];
  site: number;
  color: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = Math.max(
    0,
    logs.findIndex((log) => log.id === selectedId),
  );
  const index =
    selectedId && logs.some((log) => log.id === selectedId)
      ? selected
      : logs.length - 1;
  const current = logs[index];
  const start = logs[0] && dayTime(logs[0]),
    end = logs.at(-1) && dayTime(logs.at(-1)!);
  const x = (log: PainLog) =>
    start === end
      ? (LEFT + RIGHT) / 2
      : LEFT + ((dayTime(log) - start) / (end! - start)) * (RIGHT - LEFT);
  const y = (value: number) => BOTTOM - (value / 10) * (BOTTOM - TOP);
  const describe = (log: PainLog) =>
    `${new Date(log.date + "T12:00:00").toLocaleDateString("pl-PL")} · ${new Date(log.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} · ${log.values[site]}/10`;
  function selectAt(event: PointerEvent<SVGSVGElement>) {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix || !logs.length) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    const nearest = logs.reduce(
      (best, log, i) =>
        Math.abs(x(log) - point.x) < Math.abs(x(logs[best]) - point.x)
          ? i
          : best,
      0,
    );
    setSelectedId(logs[nearest].id);
  }
  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    let next = index;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next--;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next++;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = logs.length - 1;
    else return;
    event.preventDefault();
    setSelectedId(logs[Math.max(0, Math.min(logs.length - 1, next))].id);
  }
  return (
    <section className="panel pain-chart" aria-label={`Wykres: ${sites[site]}`}>
      <h3>{sites[site]}</h3>
      {!current ? (
        <p>Brak pomiarów.</p>
      ) : (
        <>
          <p
            className="pain-chart-reading"
            aria-live="polite"
            aria-atomic="true"
          >
            <span>
              {new Date(current.date + "T12:00:00").toLocaleDateString(
                "pl-PL",
                { day: "numeric", month: "long", year: "numeric" },
              )}{" "}
              ·{" "}
              {new Date(current.at).toLocaleTimeString("pl-PL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <strong style={{ color }}>
              {current.values[site]}
              <small>/10</small>
            </strong>
          </p>
          <svg
            ref={svg}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="slider"
            aria-label={`Pomiar bólu: ${sites[site]}`}
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={logs.length - 1}
            aria-valuenow={index}
            aria-valuetext={describe(current)}
            onKeyDown={onKeyDown}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              selectAt(event);
            }}
            onPointerMove={selectAt}
          >
            <title>
              {sites[site]}: ostatnie {logs.length} pomiarów, skala 0–10
            </title>
            {[0, 2, 4, 6, 8, 10].map((value) => (
              <g key={value}>
                <line
                  x1={LEFT}
                  x2={RIGHT}
                  y1={y(value)}
                  y2={y(value)}
                  className="pain-chart-grid"
                />
                <text x={LEFT - 10} y={y(value) + 4} textAnchor="end">
                  {value}
                </text>
              </g>
            ))}
            {logs.slice(1).map((log, i) => (
              <line
                key={log.id}
                x1={x(logs[i])}
                y1={y(logs[i].values[site])}
                x2={x(log)}
                y2={y(log.values[site])}
                stroke={color}
                strokeWidth={2.5}
                strokeDasharray={
                  dayTime(log) - dayTime(logs[i]) > 86400000 ? "5 5" : undefined
                }
              />
            ))}
            <line
              x1={x(current)}
              x2={x(current)}
              y1={TOP}
              y2={BOTTOM}
              stroke={color}
              strokeDasharray="3 4"
              opacity={0.6}
            />
            {logs.map((log, i) => (
              <circle
                key={log.id}
                cx={x(log)}
                cy={y(log.values[site])}
                r={i === index ? 5 : 3}
                fill={color}
                stroke="#192622"
                strokeWidth={i === index ? 2 : 0}
              >
                <title>{describe(log)}</title>
              </circle>
            ))}
            {[
              ...new Set([
                0,
                Math.floor((logs.length - 1) / 2),
                logs.length - 1,
              ]),
            ]
              .filter(
                (i, _, all) =>
                  all.length < 3 ||
                  i !== all[1] ||
                  (x(logs[i]) - x(logs[0]) > 65 &&
                    x(logs.at(-1)!) - x(logs[i]) > 65),
              )
              .map((i) => (
                <text
                  key={logs[i].id}
                  x={x(logs[i])}
                  y={BOTTOM + 24}
                  textAnchor={
                    logs.length === 1
                      ? "middle"
                      : i === 0
                        ? "start"
                        : i === logs.length - 1
                          ? "end"
                          : "middle"
                  }
                >
                  {shortDate(logs[i])}
                </text>
              ))}
          </svg>
        </>
      )}
    </section>
  );
}

export function PainCharts({ logs }: { logs: PainLog[] }) {
  const recent = useMemo(
    () =>
      [...logs]
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at),
        )
        .slice(-14),
    [logs],
  );
  return (
    <section aria-label="Trendy bólu">
      <h2>Ból · ostatnie 14 pomiarów</h2>
      <p className="footnote">
        Przesuwaj palcem po wykresie lub wskaż punkt, aby odczytać datę, godzinę
        i wartość. Na komputerze możesz też używać strzałek. Oś czasu pokazuje
        rzeczywiste odstępy między dniami; linia przerywana oznacza brak
        pomiarów pomiędzy wpisami.
      </p>
      {sites.map((_, site) => (
        <PainChart
          key={site}
          logs={recent}
          site={site}
          color={["#91d5a7", "#c3d994", "#efb47c"][site]}
        />
      ))}
    </section>
  );
}
