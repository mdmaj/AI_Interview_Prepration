interface ScheduleDayData {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

interface ScheduleDayProps {
  day: ScheduleDayData;
}

export default function ScheduleDay({ day }: ScheduleDayProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-4">
        {/* Day Number */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
          {day.day}
        </div>

        {/* Day Details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-gray-900">Day {day.day}</h3>

            <span className="text-sm font-medium text-gray-500">
              {day.minutes} min
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            {day.focus || "General interview preparation"}
          </p>

          {/* Question IDs */}
          {day.question_ids?.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Questions
              </p>

              <div className="flex flex-wrap gap-2">
                {day.question_ids.map((questionId) => (
                  <span
                    key={questionId}
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600"
                  >
                    {questionId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
