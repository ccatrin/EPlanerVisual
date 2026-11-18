/**
 * Тестовый скрипт для проверки конвертера EPlaner
 * Запуск: node src/converter/test.js (или npm test из папки backend)
 */

const { convertToEPlaner } = require('./eplanerConverter');

console.log('==================================================');
console.log('🧪 ЗАПУСК ТЕСТОВ КОНВЕРТЕРА EPLANER (eplanerConverter)');
console.log('==================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
  }
}

// ----------------------------------------------------
// ТЕСТ 1: Базовая линейная схема (Тест из ТЗ от Димы)
// ----------------------------------------------------
console.log('👉 Тест 1: Базовая цепочка (Шаг 1 -> Переход 1 -> Шаг 2)');
const mockData1 = {
  procedureName: "Test_Procedure",
  nodes: [
    { id: "step_1", type: "technologicalStep", data: { title: "Слив", actionType: "CIP" } },
    { id: "trans_1", type: "logicalTransition", data: { condition: "Level == 0" } },
    { id: "step_2", type: "technologicalStep", data: { title: "Нагрев", actionType: "HEAT" } }
  ],
  edges: [
    { source: "step_1", target: "trans_1" },
    { source: "trans_1", target: "step_2" }
  ]
};

const result1 = convertToEPlaner(mockData1);

assert(result1.schemaVersion === "2026.1", "Версия схемы соответствует 2026.1");
assert(result1.procedureCode === "Test_Procedure", "Название процедуры корректно");
assert(result1.algorithm.steps.length === 3, "Сформировано ровно 3 шага");
assert(result1.algorithm.steps[0].id === "step_1" && result1.algorithm.steps[0].type === "STEP", "Первый элемент - STEP (step_1)");
assert(result1.algorithm.steps[0].config.action === "CIP", "Конфигурация шага 1 содержит action = CIP");
assert(result1.algorithm.steps[0].nextElementId === "trans_1", "step_1 ссылается на trans_1");
assert(result1.algorithm.steps[1].id === "trans_1" && result1.algorithm.steps[1].type === "TRANSITION", "Второй элемент - TRANSITION (trans_1)");
assert(result1.algorithm.steps[1].rules.expression === "Level == 0", "Правило перехода содержит выражение 'Level == 0'");
assert(result1.algorithm.steps[2].id === "step_2" && result1.algorithm.steps[2].nextElementId === null, "Последний шаг ссылается на null");
assert(result1.validation.isValid === true, "Схема валидна, ошибок нет");

console.log('\nСформированный JSON алгоритма:');
console.log(JSON.stringify(result1, null, 2));

// ----------------------------------------------------
// ТЕСТ 2: Вложенная операция (nestedOperation)
// ----------------------------------------------------
console.log('\n--------------------------------------------------');
console.log('👉 Тест 2: Поддержка вложенной операции (nestedOperation)');

const mockData2 = {
  procedureName: "Nested_Procedure",
  nodes: [
    { id: "op_1", type: "nestedOperation", data: { title: "Пастеризация", subGraphId: "sub_101" } },
    { id: "trans_2", type: "logicalTransition", data: { condition: "Temp >= 72" } },
    { id: "step_3", type: "technologicalStep", data: { title: "Охлаждение", actionType: "COOL" } }
  ],
  edges: [
    { source: "op_1", target: "trans_2" },
    { source: "trans_2", target: "step_3" }
  ]
};

const result2 = convertToEPlaner(mockData2);
assert(result2.algorithm.steps[0].type === "NESTED_OPERATION", "Тип первого узла - NESTED_OPERATION");
assert(result2.algorithm.steps[0].referenceSubGraphId === "sub_101", "Ссылка на под-граф sub_101 сохранена");
assert(result2.algorithm.steps[0].name === "Пастеризация", "Имя вложенной операции передано");

// ----------------------------------------------------
// ТЕСТ 3: Параллельное ветвление (branches)
// ----------------------------------------------------
console.log('\n--------------------------------------------------');
console.log('👉 Тест 3: Параллельное ветвление (из узла выходит 2 стрелки)');

const mockData3 = {
  procedureName: "Branching_Procedure",
  nodes: [
    { id: "step_start", type: "technologicalStep", data: { title: "Старт" } },
    { id: "trans_a", type: "logicalTransition", data: { condition: "SensorA == 1" } },
    { id: "trans_b", type: "logicalTransition", data: { condition: "SensorB == 1" } }
  ],
  edges: [
    { source: "step_start", target: "trans_a" },
    { source: "step_start", target: "trans_b" }
  ]
};

const result3 = convertToEPlaner(mockData3);
assert(Array.isArray(result3.algorithm.steps[0].branches), "Ветвление распознано, поле branches является массивом");
assert(result3.algorithm.steps[0].branches.length === 2, "Ветвление содержит ровно 2 ветки");

// ----------------------------------------------------
// ТЕСТ 4: Валидация - обнаружение висячих узлов (ERR_DISCONNECTED_NODE)
// ----------------------------------------------------
console.log('\n--------------------------------------------------');
console.log('👉 Тест 4: Валидация ошибок (висячий блок без связей)');

const mockData4 = {
  procedureName: "Broken_Procedure",
  nodes: [
    { id: "step_1", type: "technologicalStep", data: { title: "Шаг 1" } },
    { id: "step_2", type: "technologicalStep", data: { title: "Шаг 2" } },
    { id: "isolated_node", type: "technologicalStep", data: { title: "Потерянный блок" } }
  ],
  edges: [
    { source: "step_1", target: "step_2" }
  ]
};

const result4 = convertToEPlaner(mockData4);
assert(result4.validation.isValid === false, "Валидация отклонила схему с висячим блоком");
assert(result4.validation.errors.some(e => e.code === "ERR_DISCONNECTED_NODE" && e.nodeId === "isolated_node"), 
  "Обнаружена ошибка ERR_DISCONNECTED_NODE для isolated_node");

// ----------------------------------------------------
// ИТОГИ
// ----------------------------------------------------
console.log('\n==================================================');
console.log(`ИТОГИ ТЕСТИРОВАНИЯ: ${passedTests} из ${totalTests} тестов пройдено успешно!`);
if (passedTests === totalTests) {
  console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! КОНВЕРТЕР ПОЛНОСТЬЮ ГОТОВ К СДАЧЕ.');
} else {
  console.log('⚠️ ЕСТЬ ОШИБКИ, ТРЕБУЕТСЯ ДОРАБОТКА.');
}
console.log('==================================================\n');
